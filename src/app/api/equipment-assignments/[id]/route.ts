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

  const existing = await db.equipmentAssignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.jobId !== undefined) data.jobId = body.jobId ? String(body.jobId) : null;
  if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const assignment = await db.equipmentAssignment.update({
    where: { id },
    data,
    include: {
      equipment: { select: { id: true, name: true, code: true, type: true, status: true, location: true, capacityPerDay: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "equipment_assignment",
    entityId: id,
    actor: session,
    summary: `Updated equipment assignment (${assignment.status})`,
    details: { assignmentId: id, equipmentId: existing.equipmentId, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({
    assignment: {
      ...assignment,
      equipment: assignment.equipment
        ? { ...assignment.equipment, capacityPerDay: Number(assignment.equipment.capacityPerDay) }
        : assignment.equipment,
    },
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.equipmentAssignment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.equipmentAssignment.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "equipment_assignment",
    entityId: id,
    actor: session,
    summary: `Deleted equipment assignment`,
    details: { assignmentId: id, equipmentId: existing.equipmentId, jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
