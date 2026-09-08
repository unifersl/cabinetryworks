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
  const customerId = searchParams.get("customerId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (customerId) where.customerId = customerId;
  if (type) where.type = type;

  const communications = await db.communicationLog.findMany({
    where,
    orderBy: [{ communicatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  return NextResponse.json({ communications });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const subject = String(body?.subject ?? "").trim();
  if (!subject) return NextResponse.json({ error: "subject is required" }, { status: 400 });

  // Either jobId or customerId should be provided (both optional individually, but at least one recommended)
  const jobId = body?.jobId ? String(body.jobId).trim() || null : null;
  const customerId = body?.customerId ? String(body.customerId).trim() || null : null;

  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (customerId) {
    const cust = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } });
    if (!cust) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const communication = await db.communicationLog.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      customerId,
      type: body?.type ? String(body.type) : "call",
      subject,
      summary: body?.summary ? String(body.summary) : null,
      actionItems: body?.actionItems ? (typeof body.actionItems === "string" ? String(body.actionItems) : JSON.stringify(body.actionItems)) : null,
      communicatedBy: body?.communicatedBy ? String(body.communicatedBy) : (session.fullName ?? session.username),
      communicatedAt: body?.communicatedAt ? new Date(body.communicatedAt) : new Date(),
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "communication",
    entityId: communication.id,
    actor: session,
    summary: `Communication logged: ${communication.type} — "${subject}"`,
    details: { communicationId: communication.id, jobId, customerId, type: communication.type },
  });

  return NextResponse.json({ communication }, { status: 201 });
});
