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
  const trade = searchParams.get("trade");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (trade) where.trade = trade;
  if (status) where.status = status;

  const subcontractors = await db.subcontractor.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { assignments: true } },
    },
  });

  return NextResponse.json({ subcontractors });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const trade = String(body?.trade ?? "").trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!trade) return NextResponse.json({ error: "trade is required" }, { status: 400 });

  // Unique check on name
  const existing = await db.subcontractor.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Subcontractor with this name already exists" }, { status: 409 });

  const rating =
    body?.rating !== undefined
      ? Math.max(1, Math.min(5, Math.floor(Number(body.rating)) || 3))
      : 3;

  const subcontractor = await db.subcontractor.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      trade,
      contactName: body?.contactName ? String(body.contactName) : null,
      phone: body?.phone ? String(body.phone) : null,
      email: body?.email ? String(body.email) : null,
      rating,
      status: body?.status ? String(body.status) : "active",
      notes: body?.notes ? String(body.notes) : null,
    },
    include: {
      _count: { select: { assignments: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "subcontractor",
    entityId: subcontractor.id,
    actor: session,
    summary: `Created subcontractor "${name}" (${trade})`,
    details: { subcontractorId: subcontractor.id, name, trade, rating, status: subcontractor.status },
  });

  return NextResponse.json({ subcontractor }, { status: 201 });
});
