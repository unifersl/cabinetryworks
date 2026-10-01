import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Server-side status-transition guard. Mirrors the `ALLOWED_TRANSITIONS` map
 * exported from `src/components/dashboard/views/job-orders.tsx` so client and
 * server enforce the same rules. Centralised here (rather than imported from
 * the client component, which can't run in an API route) for safety — even if
 * a malicious client bypasses the disabled dropdown, the server still rejects.
 *
 * The flow mirrors a typical cabinetry production pipeline:
 *   Pending → Measured → Design → In Production → Cutting → Assembly →
 *   Installation → Completed
 * with Cancelled available from any non-terminal state and Pending reachable
 * from Cancelled (to allow re-opening).
 */
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  Pending: ["Measured", "Cancelled"],
  Measured: ["Design", "Cancelled"],
  Design: ["In Production", "Cancelled"],
  "In Production": ["Cutting", "Cancelled"],
  Cutting: ["Assembly"],
  Assembly: ["Installation"],
  Installation: ["Completed"],
  Completed: [],
  Cancelled: ["Pending"],
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await db.jobOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, fullName: true, role: true } },
      measurements: {
        orderBy: { createdAt: "desc" },
        include: { takenBy: { select: { id: true, fullName: true } } },
      },
      cuttingLists: {
        orderBy: { createdAt: "desc" },
        include: { createdBy: { select: { id: true, fullName: true } } },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const k of [
    "title",
    "status",
    "priority",
    "description",
    "assignedToId",
    "jobType",
    "parentJobId",
  ]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.archived !== undefined) data.archived = Boolean(body.archived);
  if (body.deliveryDate !== undefined)
    data.deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;

  // Server-side status-transition validation. We must read the CURRENT status
  // from the DB (not from the body) so we evaluate against the actual state.
  // The read + validate + update are wrapped in a single transaction with a
  // conditional `updateMany` (where: { id, status: current.status }) so a
  // concurrent PUT can't sneak a status change between our read and update.
  // If the conditional update matches zero rows, another request changed the
  // status out from under us — we abort with 409 Conflict.
  let job;
  try {
    job = await db.$transaction(async (tx) => {
      if (body.status !== undefined) {
        const current = await tx.jobOrder.findUnique({
          where: { id },
          select: { status: true, orderNumber: true },
        });
        if (!current) {
          const e = new Error("Not found");
          e.name = "NOT_FOUND";
          throw e;
        }
        const newStatus = String(body.status);
        const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
        if (newStatus !== current.status && !allowed.includes(newStatus)) {
          const e = new Error(
            `Status transition not allowed: ${current.status} → ${newStatus}. Allowed from ${current.status}: ${
              allowed.length ? allowed.join(", ") : "(none — terminal state)"
            }.`
          );
          e.name = "INVALID_TRANSITION";
          throw e;
        }

        // Conditional update — the `status: current.status` guard is what
        // catches the TOCTOU race. If another concurrent tx has already
        // changed the status, this matches zero rows and we abort.
        const guard = await tx.jobOrder.updateMany({
          where: { id, status: current.status },
          data,
        });
        if (guard.count === 0) {
          const e = new Error("Status changed by another request — please retry");
          e.name = "RACE";
          throw e;
        }
        // updateMany doesn't return included relations — re-fetch.
        return await tx.jobOrder.findUnique({
          where: { id },
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            assignedTo: { select: { id: true, fullName: true } },
          },
        });
      }

      // No status change — unconditional update (no race to worry about).
      return await tx.jobOrder.update({
        where: { id },
        data,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.name === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof Error && err.name === "INVALID_TRANSITION") {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof Error && err.name === "RACE") {
      return NextResponse.json(
        { error: "This job's status was changed by another request. Please reload and try again." },
        { status: 409 }
      );
    }
    throw err;
  }

  // `job` is non-null here — the only paths that return null (NOT_FOUND,
  // INVALID_TRANSITION, RACE) all throw and exit via the catch above.
  // TypeScript can't see that, so we guard defensively.
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Audit: status change or assignment
  if (body.status !== undefined) {
    await recordAudit({
      action: "status_change",
      entityType: "job",
      entityId: id,
      actor: session,
      summary: `${job.orderNumber} → ${body.status}`,
      details: { newStatus: body.status, title: job.title },
    });
  }
  if (body.assignedToId !== undefined) {
    await recordAudit({
      action: "assign",
      entityType: "job",
      entityId: id,
      actor: session,
      summary: `${job.orderNumber} assigned to ${job.assignedTo?.fullName ?? "Unassigned"}`,
      details: { assignedToId: body.assignedToId, title: job.title },
    });
  }
  if (body.archived !== undefined) {
    await recordAudit({
      action: body.archived ? "update" : "update",
      entityType: "job",
      entityId: id,
      actor: session,
      summary: `${job.orderNumber} ${body.archived ? "archived" : "restored from archive"}`,
      details: { archived: body.archived, title: job.title },
    });
  }

  return NextResponse.json({ job });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });

  const { id } = await params;
  const job = await db.jobOrder.findUnique({
    where: { id },
    select: { orderNumber: true, title: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await recordAudit({
      action: "delete",
      entityType: "job",
      entityId: id,
      actor: session,
      summary: `Deleted job ${job.orderNumber}: ${job.title}`,
      details: { orderNumber: job.orderNumber },
    });

    // Clean up all related records before deleting the job to avoid FK constraint errors.
    // jobId is required (non-nullable) on most relations, so we delete child records.
    // For nullable FKs (attendanceRecord.jobId), SetNull in schema handles it — but
    // since we're deleting the job, we delete the attendance records too.
    await db.$transaction([
      db.jobTimeLog.deleteMany({ where: { jobId: id } }),
      db.jobTransport.deleteMany({ where: { jobId: id } }),
      db.jobFoodBeverage.deleteMany({ where: { jobId: id } }),
      db.jobToolIssueLine.deleteMany({ where: { issue: { jobId: id } } }),
      db.jobToolIssue.deleteMany({ where: { jobId: id } }),
      db.jobToolReturnLine.deleteMany({ where: { ret: { jobId: id } } }),
      db.jobToolReturn.deleteMany({ where: { jobId: id } }),
      db.jobExpense.deleteMany({ where: { jobId: id } }),
      db.attendanceRecord.deleteMany({ where: { jobId: id } }),
      db.stockRequestLine.deleteMany({ where: { request: { jobId: id } } }),
      db.stockRequest.deleteMany({ where: { jobId: id } }),
      db.goodsIssueLine.deleteMany({ where: { issue: { jobId: id } } }),
      db.goodsIssue.deleteMany({ where: { jobId: id } }),
      db.goodsReturnLine.deleteMany({ where: { ret: { jobId: id } } }),
      db.goodsReturn.deleteMany({ where: { jobId: id } }),
      db.outsidePurchaseLine.deleteMany({ where: { purchase: { jobId: id } } }),
      db.outsidePurchase.deleteMany({ where: { jobId: id } }),
      db.siteMeasurement.deleteMany({ where: { jobId: id } }),
      db.cuttingList.deleteMany({ where: { jobId: id } }),
      db.savedQuote.deleteMany({ where: { jobId: id } }),
      db.jobOrder.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[job-orders/DELETE] error", err);
    return NextResponse.json(
      { error: "Failed to delete job. It may have related records that could not be removed. Try archiving instead." },
      { status: 500 }
    );
  }
}
