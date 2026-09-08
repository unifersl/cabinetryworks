import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const equipmentId = searchParams.get("equipmentId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (equipmentId) where.equipmentId = equipmentId;
  if (status) where.status = status;

  const assignments = await db.equipmentAssignment.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    include: {
      equipment: { select: { id: true, name: true, code: true, type: true, status: true, location: true, capacityPerDay: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      ...a,
      equipment: a.equipment
        ? { ...a.equipment, capacityPerDay: Number(a.equipment.capacityPerDay) }
        : a.equipment,
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const equipmentId = String(body?.equipmentId ?? "").trim();
  const jobId = body?.jobId ? String(body.jobId).trim() || null : null;

  if (!equipmentId) return NextResponse.json({ error: "equipmentId is required" }, { status: 400 });

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, name: true, code: true, type: true, status: true, capacityPerDay: true },
  });
  if (!equipment) return NextResponse.json({ error: "Equipment not found" }, { status: 404 });

  // Optional job link
  let job: { id: string; orderNumber: string } | null = null;
  if (jobId) {
    job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const assignment = await db.equipmentAssignment.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      equipmentId,
      jobId,
      scheduledDate: body?.scheduledDate ? new Date(body.scheduledDate) : new Date(),
      endDate: body?.endDate ? new Date(body.endDate) : null,
      status: body?.status ? String(body.status) : "scheduled",
      notes: body?.notes ? String(body.notes) : null,
    },
    include: {
      equipment: { select: { id: true, name: true, code: true, type: true, status: true, location: true, capacityPerDay: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "assign",
    entityType: "equipment_assignment",
    entityId: assignment.id,
    actor: session,
    summary: `Assigned equipment "${equipment.name}"${job ? ` to ${job.orderNumber}` : ""}`,
    details: { assignmentId: assignment.id, equipmentId, jobId, status: assignment.status },
  });

  return NextResponse.json(
    {
      assignment: {
        ...assignment,
        equipment: assignment.equipment
          ? { ...assignment.equipment, capacityPerDay: Number(assignment.equipment.capacityPerDay) }
          : assignment.equipment,
      },
    },
    { status: 201 }
  );
});
