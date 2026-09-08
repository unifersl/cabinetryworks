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
  const subcontractorId = searchParams.get("subcontractorId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (subcontractorId) where.subcontractorId = subcontractorId;
  if (status) where.status = status;

  const assignments = await db.subcontractorAssignment.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    include: {
      subcontractor: { select: { id: true, name: true, trade: true, phone: true, email: true, status: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ assignments });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subcontractorId = String(body?.subcontractorId ?? "").trim();
  const jobId = String(body?.jobId ?? "").trim();
  const task = String(body?.task ?? "").trim();

  if (!subcontractorId) return NextResponse.json({ error: "subcontractorId is required" }, { status: 400 });
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!task) return NextResponse.json({ error: "task is required" }, { status: 400 });

  const subcontractor = await db.subcontractor.findUnique({ where: { id: subcontractorId }, select: { id: true, name: true, trade: true } });
  if (!subcontractor) return NextResponse.json({ error: "Subcontractor not found" }, { status: 404 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const assignment = await db.subcontractorAssignment.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      subcontractorId,
      jobId,
      task,
      scheduledDate: body?.scheduledDate ? new Date(body.scheduledDate) : new Date(),
      completedDate: body?.completedDate ? new Date(body.completedDate) : null,
      status: body?.status ? String(body.status) : "scheduled",
      notes: body?.notes ? String(body.notes) : null,
    },
    include: {
      subcontractor: { select: { id: true, name: true, trade: true, phone: true, email: true, status: true } },
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "assign",
    entityType: "subcontractor_assignment",
    entityId: assignment.id,
    actor: session,
    summary: `Assigned ${subcontractor.name} to ${job.orderNumber}: ${task}`,
    details: { assignmentId: assignment.id, subcontractorId, jobId, task, status: assignment.status },
  });

  return NextResponse.json({ assignment }, { status: 201 });
});
