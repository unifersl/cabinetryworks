import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateTransferNo(): Promise<string> {
  const count = await db.stockTransfer.count();
  const year = new Date().getFullYear();
  return `ST-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const transfers = await db.stockTransfer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      items: { include: { item: true } },
    },
  });

  return NextResponse.json({
    transfers: transfers.map((t) => ({
      ...t,
      itemCount: t.items.length,
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const fromWarehouseId = String(body?.fromWarehouseId ?? "");
  const toWarehouseId = String(body?.toWarehouseId ?? "");
  const itemsRaw = Array.isArray(body?.items) ? body.items : [];
  // Optional reason (audit-trail explanation). Stored in notes if no notes
  // were provided, and always echoed in the audit log details.
  const reasonText = body?.reason ? String(body.reason).trim() : "";

  if (!fromWarehouseId || !toWarehouseId) {
    return NextResponse.json({ error: "From and to warehouses are required" }, { status: 400 });
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json({ error: "Source and destination must be different" }, { status: 400 });
  }
  if (itemsRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one item" }, { status: 400 });
  }

  const [fromWh, toWh] = await Promise.all([
    db.warehouse.findUnique({ where: { id: fromWarehouseId } }),
    db.warehouse.findUnique({ where: { id: toWarehouseId } }),
  ]);
  if (!fromWh || !toWh) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }

  const status = body?.status ? String(body.status) : "draft";

  // If dispatching immediately, validate source stock levels
  if (status === "in_transit" || status === "received") {
    for (const line of itemsRaw) {
      const itemId = String(line.itemId);
      const qty = Number(line.quantity) || 0;
      if (qty <= 0) continue;
      const lotAgg = await db.stockLot.aggregate({
        where: { itemId, warehouseId: fromWarehouseId },
        _sum: { quantity: true },
      });
      const available = Number(lotAgg._sum.quantity ?? 0);
      if (available < qty) {
        const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
        return NextResponse.json(
          { error: `Insufficient stock for ${item?.name ?? itemId}. Available: ${available}, needed: ${qty}` },
          { status: 400 }
        );
      }
    }
  }

  const transferNo = await generateTransferNo();

  // Run the entire create + stock movement in one transaction so that
  // InventoryItem.stockLevel stays consistent with StockLot totals.
  const transfer = await db.$transaction(async (tx) => {
    const created = await tx.stockTransfer.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        transferNo,
        fromWarehouseId,
        toWarehouseId,
        status,
        notes: body?.notes
          ? String(body.notes)
          : reasonText || null,
        createdBy: session.id,
        receivedAt: status === "received" ? new Date() : null,
        items: {
          create: itemsRaw.map((line: Record<string, unknown>) => ({
            id: randomUUID(),
            itemId: String(line.itemId),
            quantity: Number(line.quantity) || 0,
            batchNo: line.batchNo ? String(line.batchNo) : null,
          })),
        },
      },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { item: true } },
      },
    });

    // If dispatching immediately, deduct from source lots
    if (status === "in_transit" || status === "received") {
      for (const line of created.items) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        // Deduct from source warehouse lots (FIFO)
        const lots = await tx.stockLot.findMany({
          where: { itemId: line.itemId, warehouseId: fromWarehouseId, quantity: { gt: 0 } },
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

    // If received immediately, add to destination warehouse
    if (status === "received") {
      for (const line of created.items) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        // Find or create a lot in destination warehouse for this item
        const existingLot = await tx.stockLot.findFirst({
          where: { itemId: line.itemId, warehouseId: toWarehouseId, batchNo: line.batchNo ?? null },
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
              warehouseId: toWarehouseId,
              quantity: qty,
              batchNo: line.batchNo ?? null,
              receivedDate: new Date(),
            },
          });
        }
      }
    }

    // Recalculate InventoryItem.stockLevel for every affected item so that
    // the main inventory dashboard / reports reflect the transfer.
    const affectedItemIds = new Set<string>();
    for (const line of created.items) {
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

    return created;
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: transfer.id,
    actor: session,
    summary: `Created stock transfer ${transfer.transferNo} (${status})`,
    details: { transferNo, fromWarehouseId, toWarehouseId, itemCount: itemsRaw.length, status, reason: reasonText || null },
  });

  return NextResponse.json(
    {
      transfer: {
        ...transfer,
        itemCount: transfer.items.length,
      },
    },
    { status: 201 }
  );
});
