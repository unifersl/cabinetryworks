import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
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

  const existing = await db.equipment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name && name !== existing.name) {
      const clash = await db.equipment.findUnique({ where: { name } });
      if (clash) return NextResponse.json({ error: "Equipment with this name already exists" }, { status: 409 });
    }
    data.name = name;
  }
  if (body.code !== undefined) {
    const code = body.code ? String(body.code).trim() : null;
    if (code && code !== existing.code) {
      const clash = await db.equipment.findUnique({ where: { code } });
      if (clash) return NextResponse.json({ error: "Equipment code already in use" }, { status: 409 });
    }
    data.code = code;
  }
  if (body.type !== undefined) data.type = String(body.type);
  if (body.manufacturer !== undefined) data.manufacturer = body.manufacturer ? String(body.manufacturer) : null;
  if (body.model !== undefined) data.model = body.model ? String(body.model) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.location !== undefined) data.location = body.location ? String(body.location) : null;
  if (body.capacityPerDay !== undefined) data.capacityPerDay = Number(body.capacityPerDay) || 0;
  if (body.lastServiceDate !== undefined) data.lastServiceDate = body.lastServiceDate ? new Date(body.lastServiceDate) : null;
  if (body.nextServiceDate !== undefined) data.nextServiceDate = body.nextServiceDate ? new Date(body.nextServiceDate) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const equipment = await db.equipment.update({
    where: { id },
    data,
    include: {
      _count: { select: { assignments: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "equipment",
    entityId: id,
    actor: session,
    summary: `Updated equipment "${equipment.name}"`,
    details: { equipmentId: id, changes: Object.keys(data) },
  });

  return NextResponse.json({ equipment: { ...equipment, capacityPerDay: Number(equipment.capacityPerDay) } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.equipment.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade-deletes assignments per schema (onDelete: Cascade)
  await db.equipment.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "equipment",
    entityId: id,
    actor: session,
    summary: `Deleted equipment "${existing.name}" (${existing.type})`,
    details: { equipmentId: id, name: existing.name, type: existing.type },
  });

  return NextResponse.json({ ok: true });
});
