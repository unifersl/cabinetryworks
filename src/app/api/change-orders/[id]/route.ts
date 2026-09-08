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

  const existing = await db.changeOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.changeType !== undefined) data.changeType = String(body.changeType);
  if (body.affectedItems !== undefined) data.affectedItems = typeof body.affectedItems === "string" ? String(body.affectedItems) : JSON.stringify(body.affectedItems);
  if (body.requestedBy !== undefined) data.requestedBy = body.requestedBy ? String(body.requestedBy) : null;
  if (body.impactNotes !== undefined) data.impactNotes = body.impactNotes ? String(body.impactNotes) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.approvedBy !== undefined) data.approvedBy = body.approvedBy ? String(body.approvedBy) : null;
  if (body.approvedAt !== undefined) data.approvedAt = body.approvedAt ? new Date(body.approvedAt) : null;

  // Status workflow — auto-stamp approvedBy/approvedAt when transitioning to approved
  if (body.status !== undefined) {
    const newStatus = String(body.status);
    if (newStatus === "approved" && existing.status !== "approved") {
      data.status = newStatus;
      if (!data.approvedAt) data.approvedAt = new Date();
      if (!data.approvedBy) data.approvedBy = session.fullName ?? session.username;
    } else {
      data.status = newStatus;
    }
  }

  const changeOrder = await db.changeOrder.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "change_order",
    entityId: id,
    actor: session,
    summary: `Updated change order ${changeOrder.changeNo} (${changeOrder.status})`,
    details: { changeOrderId: id, changeNo: existing.changeNo, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ changeOrder });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.changeOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.changeOrder.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "change_order",
    entityId: id,
    actor: session,
    summary: `Deleted change order ${existing.changeNo} — "${existing.title}"`,
    details: { changeOrderId: id, changeNo: existing.changeNo, jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
