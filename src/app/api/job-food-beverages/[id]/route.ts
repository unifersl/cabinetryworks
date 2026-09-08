import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.jobFoodBeverage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.mealType !== undefined) data.mealType = String(body.mealType);
  if (body.personCount !== undefined) data.personCount = Math.max(0, parseInt(String(body.personCount), 10) || 0);
  if (body.cost !== undefined) data.cost = Number(body.cost) || 0;
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const item = await db.jobFoodBeverage.update({ where: { id }, data });
  return NextResponse.json({ item: { ...item, cost: Number(item.cost) } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobFoodBeverage.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobFoodBeverage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
