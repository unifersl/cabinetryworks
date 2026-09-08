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
  const stage = searchParams.get("stage");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;
  if (stage) where.stage = stage;

  const checkpoints = await db.qCCheckpoint.findMany({
    where,
    orderBy: [{ inspectedAt: "desc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ checkpoints });
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

  const checkpoint = await db.qCCheckpoint.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      stage,
      inspector: body?.inspector ? String(body.inspector) : session.fullName,
      status: body?.status ? String(body.status) : "pending",
      checklist: body?.checklist ? (typeof body.checklist === "string" ? String(body.checklist) : JSON.stringify(body.checklist)) : null,
      photos: body?.photos ? (typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos)) : null,
      notes: body?.notes ? String(body.notes) : null,
      inspectedAt: body?.inspectedAt ? new Date(body.inspectedAt) : null,
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
    summary: `QC checkpoint "${stage}" created for ${job.orderNumber} (${checkpoint.status})`,
    details: { checkpointId: checkpoint.id, jobId, stage, status: checkpoint.status },
  });

  return NextResponse.json({ checkpoint }, { status: 201 });
});
