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
  //  1. Guard against double-receive (BELOW the optimistic check — see tx)
  //  2. Iterate line items inside the receive transaction
  // Note: this read is OUTSIDE the tx, so the status we read here is a
  // best-effort optimistic check only. The authoritative guard is the
  // conditional `updateMany({ where: { id, status: { not: "received" } } })`
  // INSIDE the transaction — that's what prevents two concurrent PUTs from
  // both passing the optimistic check and both adding stock.
  const existing = await db.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    let order;
    try {
      order = await db.$transaction(
        async (tx) => {
          // ATOMIC DOUBLE-RECEIVE GUARD: only flip status to "received" if the
          // row is currently in any non-"received" state. If two concurrent
          // PUTs race here, Postgres row locks serialise the updateMany calls:
          // the first commits (count=1), the second sees status="received"
          // and matches zero rows (count=0) — we abort before touching stock.
          // Throwing inside the tx rolls back any partial stock additions.
          const guard = await tx.purchaseOrder.updateMany({
            where: { id, status: { not: "received" } },
            data,
          });
          if (guard.count === 0) {
            throw new Error("ALREADY_RECEIVED");
          }

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

          // 3. Re-fetch the updated PO (with line items) for the response.
          //    `updateMany` doesn't return the row, so we re-query.
          return await tx.purchaseOrder.findUnique({
            where: { id },
            include: { items: true },
          });
        },
        { timeout: 15000 }
      );
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_RECEIVED") {
        return NextResponse.json(
          { error: "Already received" },
          { status: 400 }
        );
      }
      throw err;
    }

    if (body.status !== undefined) {
      await recordAudit({
        action: "status_change",
        entityType: "purchase_order",
        entityId: id,
        actor: session,
        summary: `Purchase order ${order?.poNumber ?? id} → ${body.status}`,
        details: { poNumber: order?.poNumber, newStatus: body.status },
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
      entityType: "purchase_order",
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
    entityType: "purchase_order",
    entityId: id,
    actor: session,
    summary: `Deleted purchase order ${order.poNumber}`,
  });
  await db.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
