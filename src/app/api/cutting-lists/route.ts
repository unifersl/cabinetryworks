import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Find the main warehouse to deduct cutting-list stock from.
 * Falls back to any active warehouse if no "main" type is configured.
 * Returns null if no warehouse exists at all (in which case stock deduction
 * is skipped — the cutting list is still created).
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

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const items = await db.cuttingList.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, title: true, orderNumber: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  return NextResponse.json({ cuttingLists: items });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Cutting lists involve stock deductions — require stock management permission
  if (!canManageStock(session.role)) {
    return NextResponse.json({ error: "Forbidden — cutting list creation requires stock management permission" }, { status: 403 });
  }

  const isAdmin = canManageUsers(session.role);
  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const notes = body?.notes ? String(body.notes).trim() : "";

  // Job is required UNLESS admin provides a reason
  if (!jobId) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Job is required" }, { status: 400 });
    }
    if (notes.length < 5) {
      return NextResponse.json(
        { error: "Admin override requires a reason (min 5 chars) when no job is linked." },
        { status: 400 }
      );
    }
  }

  // Validate that the linked job exists (if jobId provided)
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // --- Pre-compute everything the transaction needs (read-only) -------------
  // Doing the read-only lookups OUTSIDE the tx avoids holding a connection
  // while waiting on settings/warehouse queries. We then perform the actual
  // mutation (cutting list CREATE + stock deduction) inside a SINGLE
  // transaction so the cutting list cannot exist with un-deducted stock if
  // the deduction fails. Previously `cuttingList.create` ran outside the
  // stock-deduction tx, so a tx failure left a phantom cutting list AND
  // logged a 201 success to the user (silent inventory drift).
  const hasItems = Array.isArray(body?.items) && body.items.length > 0;
  const materialName = body?.material ? String(body.material) : null;

  let invItems: Awaited<ReturnType<typeof db.inventoryItem.findMany>> = [];
  if (hasItems && materialName) {
    invItems = await db.inventoryItem.findMany({
      where: { material: { contains: materialName } },
    });
  }

  let sheetSizeSqm = 2.88;
  if (invItems.length > 0) {
    const sheetSizeSetting = await db.systemSetting.findUnique({
      where: { key: "sheet_size_sqm" },
    });
    if (sheetSizeSetting?.value) {
      const parsed = Number(sheetSizeSetting.value);
      if (Number.isFinite(parsed) && parsed > 0) sheetSizeSqm = parsed;
    }
  }

  // Compute total area + sheets needed (pure math, no DB)
  let sheetsNeeded = 0;
  if (hasItems) {
    let totalAreaSqm = 0;
    for (const it of body.items) {
      const lengthMm = parseFloat(it.length) || 0;
      const widthMm = parseFloat(it.width) || 0;
      const qty = Number(it.qty) || 1;
      totalAreaSqm += (lengthMm * widthMm * qty) / 1_000_000;
    }
    sheetsNeeded = Math.ceil(totalAreaSqm / sheetSizeSqm);
  }

  // Resolve warehouse OUTSIDE the tx (it's a small lookup; no race risk).
  const warehouseId = (invItems.length > 0 && sheetsNeeded > 0)
    ? await findDefaultWarehouseId()
    : null;
  if (invItems.length > 0 && sheetsNeeded > 0 && !warehouseId) {
    console.warn("[cutting-lists/POST] no warehouse configured — skipping stock deduction");
  }

  const doDeduct = invItems.length > 0 && sheetsNeeded > 0 && !!warehouseId;

  // --- Atomic create + deduct (single transaction) -------------------------
  // The `cuttingList.create` is now INSIDE the same transaction as the
  // stock deduction. If any step throws, the whole tx rolls back and we
  // return 500 — no orphan cutting list, no partially-deducted stock.
  const item = await db.$transaction(
    async (tx) => {
      const created = await tx.cuttingList.create({
        data: {
          id: body?.id ? String(body.id) : randomUUID(),
          jobId,
          createdById: session.id,
          panelName: body?.panelName ? String(body.panelName) : null,
          material: body?.material ? String(body.material) : null,
          items: body?.items ? JSON.stringify(body.items) : null,
          status: body?.status ? String(body.status) : "Draft",
        },
        include: {
          job: { select: { id: true, title: true, orderNumber: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      if (doDeduct && warehouseId) {
        for (const inv of invItems) {
          // Deduct FIFO from this warehouse's StockLots
          let remaining = sheetsNeeded;
          const lots = await tx.stockLot.findMany({
            where: { itemId: inv.id, warehouseId, quantity: { gt: 0 } },
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

          // Recalculate InventoryItem.stockLevel from the new StockLot totals
          const totalAgg = await tx.stockLot.aggregate({
            where: { itemId: inv.id },
            _sum: { quantity: true },
          });
          await tx.inventoryItem.update({
            where: { id: inv.id },
            data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
          });

          await recordAudit({
            action: "update",
            entityType: "inventory_item",
            entityId: inv.id,
            actor: session,
            summary: `Auto-deducted ${sheetsNeeded} ${inv.unit} from ${inv.name} (cutting list for ${created.job?.orderNumber})`,
            details: {
              inventoryItem: inv.name,
              deducted: sheetsNeeded,
              previousStock: Number(inv.stockLevel).toString(),
              newStock: Number(totalAgg._sum.quantity ?? 0).toString(),
              cuttingListId: created.id,
              warehouseId,
            },
            tx,
          });
        }
      }

      return created;
    },
    { timeout: 15000, maxWait: 20000 },
  );

  return NextResponse.json({ cuttingList: item }, { status: 201 });
});
