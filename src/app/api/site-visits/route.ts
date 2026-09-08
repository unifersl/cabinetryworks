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

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const visits = await db.siteVisit.findMany({
    where,
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ visits });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const visitorName = String(body?.visitorName ?? "").trim();
  if (!visitorName) return NextResponse.json({ error: "visitorName is required" }, { status: 400 });

  // jobId is optional
  const jobId = body?.jobId ? String(body.jobId).trim() || null : null;
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const visit = await db.siteVisit.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      visitorName,
      visitDate: body?.visitDate ? new Date(body.visitDate) : new Date(),
      purpose: body?.purpose ? String(body.purpose) : "inspection",
      observations: body?.observations ? String(body.observations) : null,
      photos: body?.photos ? (typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos)) : null,
      actionItems: body?.actionItems ? (typeof body.actionItems === "string" ? String(body.actionItems) : JSON.stringify(body.actionItems)) : null,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "site_visit",
    entityId: visit.id,
    actor: session,
    summary: `Site visit by ${visitorName} (${visit.purpose})${jobId ? "" : " — no job linked"}`,
    details: { visitId: visit.id, jobId, visitorName, purpose: visit.purpose },
  });

  return NextResponse.json({ visit }, { status: 201 });
});
