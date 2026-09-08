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
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (category) where.category = category;

  const expenses = await db.jobExpense.findMany({
    where,
    orderBy: { date: "desc" },
  });

  // Serialize decimals
  const serialized = expenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
  }));

  // Compute summary
  const total = serialized.reduce((s, e) => s + e.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const e of serialized) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  return NextResponse.json({ expenses: serialized, summary: { total, byCategory, count: serialized.length } });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const amount = Number(body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
  }

  const expense = await db.jobExpense.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      date: body?.date ? new Date(body.date) : new Date(),
      category: String(body?.category ?? "miscellaneous").trim() || "miscellaneous",
      amount,
      currency: String(body?.currency ?? "LKR").trim() || "LKR",
      description: body?.description ? String(body.description).trim() : null,
      receiptNo: body?.receiptNo ? String(body.receiptNo).trim() : null,
      paidBy: body?.paidBy ? String(body.paidBy).trim() : null,
      notes: body?.notes ? String(body.notes).trim() : null,
      createdBy: session.id,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job_expense",
    entityId: expense.id,
    actor: session,
    summary: `Added expense ${expense.category} ${amount} ${expense.currency} to job ${job.orderNumber}`,
    details: { jobId, category: expense.category, amount, currency: expense.currency },
  });

  return NextResponse.json({ expense: { ...expense, amount: Number(expense.amount) } }, { status: 201 });
});
