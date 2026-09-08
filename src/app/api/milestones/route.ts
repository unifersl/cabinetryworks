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

  const milestones = await db.milestone.findMany({
    where,
    orderBy: [{ targetDate: "asc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ milestones });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const name = String(body?.name ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const targetDate = body?.targetDate ? new Date(body.targetDate) : new Date();

  const milestone = await db.milestone.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      name,
      targetDate,
      achievedDate: body?.achievedDate ? new Date(body.achievedDate) : null,
      status: body?.status ? String(body.status) : "pending",
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "milestone",
    entityId: milestone.id,
    actor: session,
    summary: `Milestone "${name}" created for ${job.orderNumber}`,
    details: { milestoneId: milestone.id, jobId, name, targetDate: targetDate.toISOString(), status: milestone.status },
  });

  return NextResponse.json({ milestone }, { status: 201 });
});
