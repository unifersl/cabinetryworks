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

  const items = await db.punchItem.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ items });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const title = String(body?.title ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const item = await db.punchItem.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      title,
      description: body?.description ? String(body.description) : null,
      category: body?.category ? String(body.category) : "general",
      status: body?.status ? String(body.status) : "open",
      assignedTo: body?.assignedTo ? String(body.assignedTo) : null,
      photos: body?.photos ? (typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos)) : null,
      resolvedAt: body?.resolvedAt ? new Date(body.resolvedAt) : null,
      resolution: body?.resolution ? String(body.resolution) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "punch_item",
    entityId: item.id,
    actor: session,
    summary: `Punch item "${title}" created for ${job.orderNumber}`,
    details: { punchItemId: item.id, jobId, title, category: item.category, status: item.status },
  });

  return NextResponse.json({ item }, { status: 201 });
});
