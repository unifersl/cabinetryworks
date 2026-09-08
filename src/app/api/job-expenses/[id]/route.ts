import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.jobExpense.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.category !== undefined) data.category = String(body.category).trim() || "miscellaneous";
  if (body.amount !== undefined) {
    const amt = Number(body.amount);
    if (!Number.isFinite(amt) || amt < 0) return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    data.amount = amt;
  }
  if (body.currency !== undefined) data.currency = String(body.currency).trim() || "LKR";
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.receiptNo !== undefined) data.receiptNo = body.receiptNo ? String(body.receiptNo).trim() : null;
  if (body.paidBy !== undefined) data.paidBy = body.paidBy ? String(body.paidBy).trim() : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;

  const updated = await db.jobExpense.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "job_expense",
    entityId: id,
    actor: session,
    summary: `Updated expense ${updated.category} ${updated.amount} ${updated.currency}`,
    details: { jobId: existing.jobId },
  });

  return NextResponse.json({ expense: { ...updated, amount: Number(updated.amount) } });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobExpense.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  await db.jobExpense.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job_expense",
    entityId: id,
    actor: session,
    summary: `Deleted expense ${existing.category} ${existing.amount} ${existing.currency}`,
    details: { jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
