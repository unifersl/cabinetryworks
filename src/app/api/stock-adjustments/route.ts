import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
// Note: db is the Prisma client — schema relation additions (e.g. StockAdjustment.job)
// require the @prisma/client to be regenerated (`bunx prisma generate`) and the
// dev server's Turbopack cache to be cleared for the new fields to be picked up.
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateAdjNo(): Promise<string> {
  const count = await db.stockAdjustment.count();
  const year = new Date().getFullYear();
  return `ADJ-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get("warehouseId");
  const itemId = searchParams.get("itemId");
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (warehouseId) where.warehouseId = warehouseId;
  if (itemId) where.itemId = itemId;
  if (jobId) where.jobId = jobId;

  const adjustments = await db.stockAdjustment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { item: true, warehouse: true, job: true },
  });

  return NextResponse.json({
    adjustments: adjustments.map((a) => ({
      ...a,
      oldQty: a.oldQty.toString(),
      newQty: a.newQty.toString(),
      diff: a.diff.toString(),
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const itemId = String(body?.itemId ?? "");
  const warehouseId = String(body?.warehouseId ?? "");
  const type = String(body?.type ?? "set"); // set | add | remove | dispose
  const jobId = body?.jobId ? String(body.jobId) : null;
  const reasonText = body?.reason ? String(body.reason).trim() : "";

  if (!itemId || !warehouseId) {
    return NextResponse.json({ error: "Item and warehouse are required" }, { status: 400 });
  }

  // A textual reason (>= 5 chars) is required so every adjustment has an
  // audit-trail explanation for why stock was changed.
  if (reasonText.length < 5) {
    return NextResponse.json(
      { error: "A reason of at least 5 characters is required for stock adjustments." },
      { status: 400 }
    );
  }

  const [item, warehouse] = await Promise.all([
    db.inventoryItem.findUnique({ where: { id: itemId } }),
    db.warehouse.findUnique({ where: { id: warehouseId } }),
  ]);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  // If a job is provided, validate it exists
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Aggregate current qty in this warehouse
  const lotAgg = await db.stockLot.aggregate({
    where: { itemId, warehouseId },
    _sum: { quantity: true },
  });
  const oldQty = Number(lotAgg._sum.quantity ?? 0);

  let newQty = oldQty;
  const inputQty = Number(body?.quantity ?? 0);

  if (type === "set") newQty = inputQty;
  else if (type === "add") newQty = oldQty + inputQty;
  else if (type === "remove") newQty = Math.max(0, oldQty - inputQty);
  else if (type === "dispose") newQty = Math.max(0, oldQty - inputQty);

  if (newQty < 0) newQty = 0;
  const diff = newQty - oldQty;

  const adjNo = await generateAdjNo();

  const adjustment = await db.$transaction(async (tx) => {
    // Update lots: find a lot or create one to apply the change
    if (diff !== 0) {
      const existingLot = await tx.stockLot.findFirst({
        where: { itemId, warehouseId, quantity: { gt: 0 } },
        orderBy: { receivedDate: "asc" },
      });

      if (diff < 0) {
        // Reduce stock — deduct FIFO across lots
        let remaining = Math.abs(diff);
        const lots = await tx.stockLot.findMany({
          where: { itemId, warehouseId, quantity: { gt: 0 } },
          orderBy: { receivedDate: "asc" },
        });
        for (const lot of lots) {
          if (remaining <= 0) break;
          const take = Math.min(Number(lot.quantity), remaining);
          await tx.stockLot.update({
            where: { id: lot.id },
            data: { quantity: Number(lot.quantity) - take },
          });
          remaining -= take;
        }
      } else {
        // Increase stock — add to existing lot or create new
        if (existingLot) {
          await tx.stockLot.update({
            where: { id: existingLot.id },
            data: { quantity: Number(existingLot.quantity) + diff },
          });
        } else {
          await tx.stockLot.create({
            data: {
              id: randomUUID(),
              itemId,
              warehouseId,
              quantity: diff,
              receivedDate: new Date(),
              batchNo: body?.batchNo ? String(body.batchNo) : null,
            },
          });
        }
      }
    }

    // Create adjustment record
    const adj = await tx.stockAdjustment.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        adjNo,
        itemId,
        warehouseId,
        jobId,
        type,
        oldQty,
        newQty,
        diff,
        reason: reasonText || null,
        notes: body?.notes ? String(body.notes) : null,
        adjustedBy: session.id,
      },
      include: { item: true, warehouse: true, job: true },
    });

    // Update item's overall stockLevel to reflect the new total across all warehouses
    const totalAgg = await tx.stockLot.aggregate({
      where: { itemId },
      _sum: { quantity: true },
    });
    const newTotal = Number(totalAgg._sum.quantity ?? 0);
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { stockLevel: newTotal, lastRestocked: diff > 0 ? new Date() : item.lastRestocked },
    });

    return adj;
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: adjustment.id,
    actor: session,
    summary: `Stock adjustment ${adjNo} — ${item.name} (${type}, ${diff >= 0 ? "+" : ""}${diff})`,
    details: { adjNo, itemId, warehouseId, jobId, type, oldQty, newQty, diff, reason: reasonText },
  });

  return NextResponse.json(
    {
      adjustment: {
        ...adjustment,
        oldQty: adjustment.oldQty.toString(),
        newQty: adjustment.newQty.toString(),
        diff: adjustment.diff.toString(),
      },
    },
    { status: 201 }
  );
});
