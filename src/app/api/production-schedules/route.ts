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
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;

  const schedules = await db.productionSchedule.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  // Enrich with customer name on the job
  const customerIds = [
    ...new Set(schedules.map((s) => s.job?.customerId).filter(Boolean) as string[]),
  ];
  const customers =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
  const custMap = new Map(customers.map((c) => [c.id, c.name]));

  const result = schedules.map((s) => ({
    ...s,
    job: s.job
      ? { ...s.job, customerName: custMap.get(s.job.customerId) ?? null }
      : s.job,
  }));

  return NextResponse.json({ schedules: result });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const stage = String(body?.stage ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!stage) return NextResponse.json({ error: "stage is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const schedule = await db.productionSchedule.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      stage,
      workstation: body?.workstation ? String(body.workstation) : null,
      scheduledDate: body?.scheduledDate ? new Date(body.scheduledDate) : new Date(),
      endDate: body?.endDate ? new Date(body.endDate) : null,
      assignedToId: body?.assignedToId ? String(body.assignedToId) : null,
      status: body?.status ? String(body.status) : "scheduled",
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Scheduled production stage "${stage}" for ${job.orderNumber}`,
    details: { scheduleId: schedule.id, jobId, stage, status: schedule.status },
  });

  return NextResponse.json({ schedule }, { status: 201 });
});
