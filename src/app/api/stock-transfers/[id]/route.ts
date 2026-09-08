import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const transfer = await db.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { item: true } },
    },
  });

  if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ transfer: { ...transfer, itemCount: transfer.items.length } });
});

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const transfer = await db.stockTransfer.findUnique({
    where: { id },
    include: { items: true, fromWarehouse: true, toWarehouse: true },
  });
  if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = body?.status ? String(body.status) : transfer.status;
  const oldStatus = transfer.status;

  if (newStatus === oldStatus && body?.notes === undefined) {
    return NextResponse.json({ transfer: { ...transfer, itemCount: transfer.items.length } });
  }

  // Status transitions
  // draft → in_transit: deduct from source lots
  // in_transit → received: add to destination lots
  // draft → received: do both
  // any → cancelled: if items were already deducted from source, return them

  const updates: Record<string, unknown> = {};
  if (body?.notes !== undefined) updates.notes = body.notes ? String(body.notes) : null;
  updates.status = newStatus;

  await db.$transaction(async (tx) => {
    // Case: deducting from source (was draft, now in_transit or received)
    if (
      (oldStatus === "draft" && (newStatus === "in_transit" || newStatus === "received"))
    ) {
      for (const line of transfer.items) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        const lots = await tx.stockLot.findMany({
          where: { itemId: line.itemId, warehouseId: transfer.fromWarehouseId, quantity: { gt: 0 } },
          orderBy: { receivedDate: "asc" },
        });
        let remaining = qty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(Number(lot.quantity), remaining);
          await tx.stockLot.update({
            where: { id: lot.id },
            data: { quantity: Number(lot.quantity) - take },
          });
          remaining -= take;
        }
      }
    }

    // Case: adding to destination (became received and wasn't before)
    if (newStatus === "received" && oldStatus !== "received") {
      updates.receivedAt = new Date();
      for (const line of transfer.items) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        const existingLot = await tx.stockLot.findFirst({
          where: { itemId: line.itemId, warehouseId: transfer.toWarehouseId, batchNo: line.batchNo ?? null },
        });
        if (existingLot) {
          await tx.stockLot.update({
            where: { id: existingLot.id },
            data: { quantity: Number(existingLot.quantity) + qty, receivedDate: new Date() },
          });
        } else {
          await tx.stockLot.create({
            data: {
              id: randomUUID(),
              itemId: line.itemId,
              warehouseId: transfer.toWarehouseId,
              quantity: qty,
              batchNo: line.batchNo ?? null,
              receivedDate: new Date(),
            },
          });
        }
      }
    }

    // Case: cancelling — if we previously deducted from source, return the stock
    if (newStatus === "cancelled" && oldStatus !== "draft" && oldStatus !== "cancelled") {
      // If it was received, we should reverse the destination add too
      if (oldStatus === "received") {
        for (const line of transfer.items) {
          const qty = Number(line.quantity);
          if (qty <= 0) continue;
          const destLot = await tx.stockLot.findFirst({
            where: { itemId: line.itemId, warehouseId: transfer.toWarehouseId, batchNo: line.batchNo ?? null },
            orderBy: { receivedDate: "desc" },
          });
          if (destLot) {
            const newQty = Math.max(0, Number(destLot.quantity) - qty);
            await tx.stockLot.update({ where: { id: destLot.id }, data: { quantity: newQty } });
          }
        }
      }
      // Return stock to source
      for (const line of transfer.items) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        const srcLot = await tx.stockLot.findFirst({
          where: { itemId: line.itemId, warehouseId: transfer.fromWarehouseId, batchNo: line.batchNo ?? null },
        });
        if (srcLot) {
          await tx.stockLot.update({
            where: { id: srcLot.id },
            data: { quantity: Number(srcLot.quantity) + qty },
          });
        } else {
          await tx.stockLot.create({
            data: {
              id: randomUUID(),
              itemId: line.itemId,
              warehouseId: transfer.fromWarehouseId,
              quantity: qty,
              batchNo: line.batchNo ?? null,
              receivedDate: new Date(),
            },
          });
        }
      }
    }

    const updated = await tx.stockTransfer.update({ where: { id }, data: updates });

    // Recalculate InventoryItem.stockLevel for every affected item so that
    // the main inventory dashboard / reports reflect the transfer.
    const affectedItemIds = new Set<string>();
    for (const line of transfer.items) {
      if (Number(line.quantity) > 0) affectedItemIds.add(line.itemId);
    }
    for (const itemId of affectedItemIds) {
      const totalAgg = await tx.stockLot.aggregate({
        where: { itemId },
        _sum: { quantity: true },
      });
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
      });
    }

    await recordAudit({
      action: "update",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Transfer ${updated.transferNo}: ${oldStatus} → ${newStatus}`,
    });
  });

  const refreshed = await db.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { item: true } },
    },
  });

  return NextResponse.json({
    transfer: refreshed ? { ...refreshed, itemCount: refreshed.items.length } : null,
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const transfer = await db.stockTransfer.findUnique({ where: { id } });
  if (!transfer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (transfer.status === "in_transit" || transfer.status === "received") {
    return NextResponse.json(
      { error: "Cannot delete a transfer that is in transit or received. Cancel it instead." },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted transfer ${transfer.transferNo}`,
  });
  await db.stockTransfer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
