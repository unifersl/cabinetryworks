import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.subcontractorAssignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.task !== undefined) data.task = String(body.task);
  if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  // Status workflow — auto-stamp completedDate when transitioning to completed
  if (body.status !== undefined) {
    const newStatus = String(body.status);
    data.status = newStatus;
    if (newStatus === "completed" && existing.status !== "completed") {
      data.completedDate = body.completedDate ? new Date(body.completedDate) : new Date();
    } else if (body.completedDate !== undefined) {
      data.completedDate = body.completedDate ? new Date(body.completedDate) : null;
    }
  } else if (body.completedDate !== undefined) {
    data.completedDate = body.completedDate ? new Date(body.completedDate) : null;
  }

  const assignment = await db.subcontractorAssignment.update({
    where: { id },
    data,
    include: {
      subcontractor: { select: { id: true, name: true, trade: true, phone: true, email: true, status: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "subcontractor_assignment",
    entityId: id,
    actor: session,
    summary: `Updated subcontractor assignment "${assignment.task}" (${assignment.status})`,
    details: { assignmentId: id, subcontractorId: existing.subcontractorId, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ assignment });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.subcontractorAssignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.subcontractorAssignment.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "subcontractor_assignment",
    entityId: id,
    actor: session,
    summary: `Deleted subcontractor assignment "${existing.task}"`,
    details: { assignmentId: id, subcontractorId: existing.subcontractorId, jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
