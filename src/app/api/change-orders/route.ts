import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Generate the next sequential change order number for the current year.
 * Format: CO-YYYY-0001 (zero-padded to 4 digits, scoped per year).
 */
async function generateChangeNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CO-${year}-`;
  // Find the highest existing sequence number for this year
  const latest = await db.changeOrder.findMany({
    where: { changeNo: { startsWith: prefix } },
    select: { changeNo: true },
  });
  let maxSeq = 0;
  for (const c of latest) {
    const seqStr = c.changeNo.replace(prefix, "");
    const n = parseInt(seqStr, 10);
    if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;

  const changeOrders = await db.changeOrder.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ changeOrders });
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

  // Allow client-supplied changeNo (with unique check) — otherwise auto-generate
  let changeNo: string;
  if (body?.changeNo) {
    changeNo = String(body.changeNo);
    const clash = await db.changeOrder.findUnique({ where: { changeNo } });
    if (clash) return NextResponse.json({ error: "changeNo already exists" }, { status: 409 });
  } else {
    changeNo = await generateChangeNo();
  }

  // Auto-stamp approval metadata on transition to approved
  let approvedBy: string | null = body?.approvedBy ? String(body.approvedBy) : null;
  let approvedAt: Date | null = body?.approvedAt ? new Date(body.approvedAt) : null;
  const status = body?.status ? String(body.status) : "pending";
  if (status === "approved" && !approvedAt) {
    approvedAt = new Date();
    if (!approvedBy) approvedBy = session.fullName ?? session.username;
  }

  const changeOrder = await db.changeOrder.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      changeNo,
      title,
      description: body?.description ? String(body.description) : null,
      changeType: body?.changeType ? String(body.changeType) : "modification",
      affectedItems: body?.affectedItems ? (typeof body.affectedItems === "string" ? String(body.affectedItems) : JSON.stringify(body.affectedItems)) : null,
      status,
      requestedBy: body?.requestedBy ? String(body.requestedBy) : null,
      approvedBy,
      approvedAt,
      impactNotes: body?.impactNotes ? String(body.impactNotes) : null,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "change_order",
    entityId: changeOrder.id,
    actor: session,
    summary: `Change order ${changeNo} created for ${job.orderNumber} — ${title}`,
    details: { changeOrderId: changeOrder.id, changeNo, jobId, title, changeType: changeOrder.changeType, status },
  });

  return NextResponse.json({ changeOrder }, { status: 201 });
});
