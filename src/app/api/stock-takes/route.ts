import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateTakeNo(): Promise<string> {
  const count = await db.stockTake.count();
  const year = new Date().getFullYear();
  return `STK-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get("warehouseId");

  const where: Record<string, unknown> = {};
  if (warehouseId) where.warehouseId = warehouseId;

  const stockTakes = await db.stockTake.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      _count: { select: { lines: true } },
    },
  });

  return NextResponse.json({
    stockTakes: stockTakes.map((t) => ({
      ...t,
      lineCount: t._count.lines,
      _count: undefined,
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const warehouseId = String(body?.warehouseId ?? "");
  const period = String(body?.period ?? "");

  if (!warehouseId || !period) {
    return NextResponse.json({ error: "Warehouse and period are required" }, { status: 400 });
  }

  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  const takeNo = await generateTakeNo();

  // Load all items that have stock (or all items) in this warehouse
  const lots = await db.stockLot.findMany({
    where: { warehouseId },
    include: { item: true },
  });

  // Aggregate per item
  const perItem = new Map<string, number>();
  for (const lot of lots) {
    perItem.set(lot.itemId, (perItem.get(lot.itemId) ?? 0) + Number(lot.quantity));
  }

  // If no lots, include all active inventory items with 0 system qty
  let itemIds = Array.from(perItem.keys());
  if (itemIds.length === 0) {
    const allItems = await db.inventoryItem.findMany({
      where: { status: "active" },
      select: { id: true },
    });
    itemIds = allItems.map((i) => i.id);
    for (const id of itemIds) perItem.set(id, 0);
  }

  const stockTake = await db.stockTake.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      takeNo,
      warehouseId,
      period,
      status: "open",
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
      lines: {
        create: itemIds.map((itemId) => ({
          id: randomUUID(),
          itemId,
          systemQty: perItem.get(itemId) ?? 0,
          countedQty: perItem.get(itemId) ?? 0,
          diff: 0,
        })),
      },
    },
    include: {
      warehouse: true,
      lines: { include: { item: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: stockTake.id,
    actor: session,
    summary: `Created stock take ${takeNo} for ${warehouse.name} — ${period}`,
    details: { takeNo, warehouseId, period, lineCount: itemIds.length },
  });

  return NextResponse.json(
    {
      stockTake: {
        ...stockTake,
        lineCount: stockTake.lines.length,
      },
    },
    { status: 201 }
  );
});
