import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db.inventoryItem.findMany({
    orderBy: { name: "asc" },
    include: {
      category: true,
      stockLots: { select: { id: true, warehouseId: true, quantity: true } },
    },
  });

  // Compute alerts
  const lowStock = items.filter(
    (i) => Number(i.stockLevel) <= Number(i.reorderPoint) && Number(i.reorderPoint) > 0
  );

  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      stockLevel: Number(i.stockLevel),
      minStock: Number(i.minStock),
      reorderPoint: Number(i.reorderPoint),
      unitCost: Number(i.unitCost),
    })),
    stats: {
      total: items.length,
      lowStock: lowStock.length,
      outOfStock: items.filter((i) => Number(i.stockLevel) === 0).length,
    },
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const material = String(body?.material ?? "").trim();

  if (!name || !material) {
    return NextResponse.json({ error: "Name and material are required" }, { status: 400 });
  }

  const existing = await db.inventoryItem.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Item with this name already exists" }, { status: 409 });
  }

  const item = await db.inventoryItem.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      code: body?.code ? String(body.code) : null,
      material,
      thickness: body?.thickness ? String(body.thickness) : null,
      unit: body?.unit ? String(body.unit) : "sheet",
      stockLevel: Number(body?.stockLevel ?? 0),
      minStock: Number(body?.minStock ?? 0),
      reorderPoint: Number(body?.reorderPoint ?? 0),
      unitCost: Number(body?.unitCost ?? 0),
      supplier: body?.supplier ? String(body.supplier) : null,
      categoryId: body?.categoryId ? String(body.categoryId) : null,
      status: body?.status ? String(body.status) : "active",
      notes: body?.notes ? String(body.notes) : null,
      lastRestocked: body?.lastRestocked ? new Date(body.lastRestocked) : null,
    },
    include: { category: true },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: item.id,
    actor: session,
    summary: `Created inventory item: ${item.name}`,
    details: { name, material, stockLevel: item.stockLevel.toString() },
  });

  return NextResponse.json({
    item: {
      ...item,
      stockLevel: Number(item.stockLevel),
      minStock: Number(item.minStock),
      reorderPoint: Number(item.reorderPoint),
      unitCost: Number(item.unitCost),
    },
  }, { status: 201 });
});
