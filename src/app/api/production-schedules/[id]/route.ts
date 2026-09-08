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

  const existing = await db.productionSchedule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.stage !== undefined) data.stage = String(body.stage);
  if (body.workstation !== undefined) data.workstation = body.workstation ? String(body.workstation) : null;
  if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.assignedToId !== undefined) data.assignedToId = body.assignedToId ? String(body.assignedToId) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const schedule = await db.productionSchedule.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Updated production schedule for stage "${schedule.stage}"`,
    details: { scheduleId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ schedule });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.productionSchedule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.productionSchedule.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted production schedule for stage "${existing.stage}"`,
    details: { scheduleId: id, jobId: existing.jobId, stage: existing.stage },
  });

  return NextResponse.json({ ok: true });
});
