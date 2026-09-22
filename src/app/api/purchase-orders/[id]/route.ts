import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Find the default warehouse to land received PO stock into.
 * PurchaseOrder has no warehouseId column (it pre-dates the multi-warehouse
 * stock model), so we route received stock into the main warehouse, falling
 * back to any active warehouse if no "main" is configured.
 */
async function findDefaultWarehouseId(): Promise<string | null> {
  const main = await db.warehouse.findFirst({
    where: { type: "main", isActive: true },
    orderBy: { code: "asc" },
  });
  if (main) return main.id;
  const anyActive = await db.warehouse.findFirst({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  return anyActive?.id ?? null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Look up the existing order (with line items) so we can:
  //  1. Guard against double-receive
  //  2. Iterate line items inside the receive transaction
  const existing = await db.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Double-receive guard: refuse to re-receive an already-received PO
  if (body.status === "received" && existing.status === "received") {
    return NextResponse.json({ error: "Already received" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.expectedDate !== undefined)
    data.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;

  // If marking as received, restock inventory items via the canonical
  // StockLot → recalc InventoryItem.stockLevel pattern, all inside a single
  // transaction so a crash mid-loop cannot leave some items received and
  // others not.
  if (body.status === "received") {
    data.receivedDate = new Date();

    const warehouseId = await findDefaultWarehouseId();
    if (!warehouseId) {
      return NextResponse.json(
        { error: "No warehouse configured — cannot receive purchase order (no destination for StockLot)" },
        { status: 400 }
      );
    }

    const order = await db.$transaction(
      async (tx) => {
        // 1. For each linked line item, find-or-create a StockLot in the
        //    destination warehouse and add the received quantity.
        const affectedItemIds = new Set<string>();
        for (const line of existing.items) {
          if (!line.inventoryItemId) continue;
          const qty = Number(line.quantity);
          if (qty <= 0) continue;

          const existingLot = await tx.stockLot.findFirst({
            where: { itemId: line.inventoryItemId, warehouseId },
          });
          if (existingLot) {
            await tx.stockLot.update({
              where: { id: existingLot.id },
              data: {
                quantity: Number(existingLot.quantity) + qty,
                receivedDate: new Date(),
              },
            });
          } else {
            await tx.stockLot.create({
              data: {
                id: randomUUID(),
                itemId: line.inventoryItemId,
                warehouseId,
                quantity: qty,
                receivedDate: new Date(),
              },
            });
          }
          affectedItemIds.add(line.inventoryItemId);
        }

        // 2. Recalculate InventoryItem.stockLevel = SUM(StockLot.quantity)
        //    for every affected item, and bump lastRestocked.
        for (const itemId of affectedItemIds) {
          const totalAgg = await tx.stockLot.aggregate({
            where: { itemId },
            _sum: { quantity: true },
          });
          await tx.inventoryItem.update({
            where: { id: itemId },
            data: {
              stockLevel: Number(totalAgg._sum.quantity ?? 0),
              lastRestocked: new Date(),
            },
          });
        }

        // 3. Update the PO itself (status, notes, expectedDate, receivedDate).
        return await tx.purchaseOrder.update({
          where: { id },
          data,
          include: { items: true },
        });
      },
      { timeout: 15000 }
    );

    if (body.status !== undefined) {
      await recordAudit({
        action: "status_change",
        entityType: "settings",
        entityId: id,
        actor: session,
        summary: `Purchase order ${order.poNumber} → ${body.status}`,
        details: { poNumber: order.poNumber, newStatus: body.status },
      });
    }

    return NextResponse.json({ order });
  }

  // Non-receive updates (status/notes/expectedDate) — no stock sync needed.
  const order = await db.purchaseOrder.update({
    where: { id },
    data,
    include: { items: true },
  });

  if (body.status !== undefined) {
    await recordAudit({
      action: "status_change",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Purchase order ${order.poNumber} → ${body.status}`,
      details: { poNumber: order.poNumber, newStatus: body.status },
    });
  }

  return NextResponse.json({ order });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await db.purchaseOrder.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted purchase order ${order.poNumber}`,
  });
  await db.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
