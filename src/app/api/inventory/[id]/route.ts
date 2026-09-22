import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canDeleteStock, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // P0 integrity guard: stockLevel must NEVER be written directly via PUT.
  // The canonical pattern is StockLot → recalc stockLevel (see /api/stock-adjustments,
  // /api/purchase-orders/[id]/receive, /api/goods-issues, etc.). Writing it here
  // bypasses the StockLot audit trail and desyncs warehouse lots from the
  // dashboard stockLevel.
  if (body.stockLevel !== undefined) {
    return NextResponse.json(
      { error: "Use /api/stock-adjustments to change stock levels (ensures StockLot audit trail)" },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "material", "thickness", "unit", "supplier", "status", "notes"]) {
    if (body[k] !== undefined) {
      data[k] = body[k] === "" || body[k] === null ? null : String(body[k]);
    }
  }
  for (const k of ["minStock", "reorderPoint", "unitCost"]) {
    if (body[k] !== undefined) data[k] = Number(body[k]);
  }
  if (body.categoryId !== undefined) {
    data.categoryId = body.categoryId ? String(body.categoryId) : null;
  }
  if (body.lastRestocked !== undefined) {
    data.lastRestocked = body.lastRestocked ? new Date(body.lastRestocked) : null;
  }

  const item = await db.inventoryItem.update({
    where: { id },
    data,
    include: { category: true },
  });

  await recordAudit({
    action: "update",
    entityType: "inventory_item",
    entityId: id,
    actor: session,
    summary: `Updated inventory: ${item.name} (stock: ${item.stockLevel})`,
  });

  // Serialize Decimal fields to numbers for consistent JSON response
  return NextResponse.json({
    item: {
      ...item,
      stockLevel: Number(item.stockLevel),
      minStock: Number(item.minStock),
      reorderPoint: Number(item.reorderPoint),
      unitCost: Number(item.unitCost),
    },
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Delete/dispose requires admin or manager permission (storekeeper cannot delete)
  if (!canDeleteStock(session.role))
    return NextResponse.json({ error: "Forbidden — deleting stock items requires admin or manager permission" }, { status: 403 });

  const { id } = await params;
  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // P0 integrity guard: refuse delete when StockLot history exists for this
  // item. The schema cascades StockLot deletes (onDelete: Cascade), so a
  // naive delete silently destroys batch-level history and breaks warehouse
  // FIFO tracking. Require the item to be marked "disposed" first (which is
  // the documented lifecycle: dispose → audit trail retained → optional
  // hard-delete once financial close has run).
  if (item.status !== "disposed") {
    return NextResponse.json(
      { error: "Cannot delete an inventory item that is not disposed. Mark the item as 'disposed' (via stock-adjustment type 'dispose' or status update) first." },
      { status: 400 }
    );
  }

  const lotCount = await db.stockLot.count({ where: { itemId: id } });
  if (lotCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${lotCount} stock lot(s) still reference this item. Clear lots via stock transfers or write-offs before hard-deleting.` },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "inventory_item",
    entityId: id,
    actor: session,
    summary: `Deleted inventory item: ${item.name}`,
  });
  await db.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
