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
  const type = searchParams.get("type");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (status) where.status = status;

  const equipment = await db.equipment.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { assignments: true } },
    },
  });

  // Serialize Decimal capacityPerDay
  return NextResponse.json({
    equipment: equipment.map((e) => ({
      ...e,
      capacityPerDay: Number(e.capacityPerDay),
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const type = String(body?.type ?? "").trim();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  // Unique name check
  const existing = await db.equipment.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "Equipment with this name already exists" }, { status: 409 });

  // Unique code check (if provided)
  let code: string | null = body?.code ? String(body.code).trim() || null : null;
  if (code) {
    const codeClash = await db.equipment.findUnique({ where: { code } });
    if (codeClash) return NextResponse.json({ error: "Equipment code already in use" }, { status: 409 });
  } else {
    code = null;
  }

  const equipment = await db.equipment.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      code,
      type,
      manufacturer: body?.manufacturer ? String(body.manufacturer) : null,
      model: body?.model ? String(body.model) : null,
      status: body?.status ? String(body.status) : "operational",
      location: body?.location ? String(body.location) : null,
      capacityPerDay: body?.capacityPerDay !== undefined ? Number(body.capacityPerDay) || 0 : 0,
      lastServiceDate: body?.lastServiceDate ? new Date(body.lastServiceDate) : null,
      nextServiceDate: body?.nextServiceDate ? new Date(body.nextServiceDate) : null,
      notes: body?.notes ? String(body.notes) : null,
    },
    include: {
      _count: { select: { assignments: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "equipment",
    entityId: equipment.id,
    actor: session,
    summary: `Created equipment "${name}" (${type})`,
    details: { equipmentId: equipment.id, name, code, type, status: equipment.status },
  });

  return NextResponse.json(
    { equipment: { ...equipment, capacityPerDay: Number(equipment.capacityPerDay) } },
    { status: 201 }
  );
});
