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

  const items = await db.jobFoodBeverage.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ items: items.map((i) => ({ ...i, cost: Number(i.cost) })) });
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

  const item = await db.jobFoodBeverage.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      date: body?.date ? new Date(body.date) : new Date(),
      mealType: body?.mealType ? String(body.mealType) : "lunch",
      personCount: body?.personCount !== undefined ? Math.max(0, parseInt(String(body.personCount), 10) || 0) : 1,
      cost: body?.cost !== undefined ? Number(body.cost) || 0 : 0,
      description: body?.description ? String(body.description) : null,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `F&B log: ${item.mealType} ×${item.personCount} on ${job.orderNumber}`,
    details: { fbId: item.id, jobId, mealType: item.mealType, personCount: item.personCount },
  });

  return NextResponse.json({ item: { ...item, cost: Number(item.cost) } }, { status: 201 });
});
