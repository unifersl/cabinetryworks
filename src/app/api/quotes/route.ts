import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const quotes = await db.savedQuote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ quotes });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
  }

  const job = await db.jobOrder.findUnique({
    where: { id: jobId },
    select: { id: true, customerId: true, orderNumber: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Generate quote number
  const count = await db.savedQuote.count();
  const quoteNumber = `Q-${String(count + 1).padStart(5, "0")}`;

  // Get settings for currency/tax
  const settingsRows = await db.systemSetting.findMany();
  const settings = settingsRows.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.value ?? "";
    return acc;
  }, {});

  const quote = await db.savedQuote.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      quoteNumber,
      jobId,
      customerId: job.customerId,
      status: "draft",
      materialCost: Number(body?.materialCost ?? 0),
      edgeCost: Number(body?.edgeCost ?? 0),
      laborCost: Number(body?.laborCost ?? 0),
      subtotal: Number(body?.subtotal ?? 0),
      taxRate: Number(body?.taxRate ?? settings.tax_rate ?? 0),
      taxAmount: Number(body?.taxAmount ?? 0),
      total: Number(body?.total ?? 0),
      currency: body?.currency ?? settings.currency ?? "USD",
      notes: body?.notes ? String(body.notes) : null,
      validUntil: body?.validUntil ? new Date(body.validUntil) : null,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: quote.id,
    actor: session,
    summary: `Created quote ${quote.quoteNumber} for ${quote.job.orderNumber}`,
    details: { quoteNumber, jobId, total: quote.total.toString() },
  });

  return NextResponse.json({ quote }, { status: 201 });
}
