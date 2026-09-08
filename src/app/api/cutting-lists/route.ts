import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
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

  const item = await db.cuttingList.create({
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

  // Auto-deduct inventory: if items have a material matching an inventory
  // item, deduct the total sheets needed from the warehouse's StockLot
  // (FIFO) and recalculate InventoryItem.stockLevel. Previously this just
  // wrote directly to InventoryItem.stockLevel, bypassing the StockLot
  // source-of-truth and breaking stock-take / adjustment reports.
  if (body?.items && Array.isArray(body.items) && body.items.length > 0) {
    try {
      const materialName = body?.material ? String(body.material) : null;
      // Find matching inventory items by material type
      const invItems = materialName
        ? await db.inventoryItem.findMany({
            where: { material: { contains: materialName } },
          })
        : [];

      if (invItems.length > 0) {
        // Get configurable sheet size from settings (default 2.88 m² = 2400×1200mm)
        const sheetSizeSetting = await db.systemSetting.findUnique({
          where: { key: "sheet_size_sqm" },
        });
        const sheetSizeSqm = sheetSizeSetting?.value
          ? Number(sheetSizeSetting.value)
          : 2.88;

        // Calculate total area in m²
        let totalAreaSqm = 0;
        for (const it of body.items) {
          const lengthMm = parseFloat(it.length) || 0;
          const widthMm = parseFloat(it.width) || 0;
          const qty = Number(it.qty) || 1;
          totalAreaSqm += (lengthMm * widthMm * qty) / 1_000_000;
        }
        // Calculate sheets needed using configurable sheet size
        const sheetsNeeded = Math.ceil(totalAreaSqm / sheetSizeSqm);

        const warehouseId = await findDefaultWarehouseId();
        if (!warehouseId) {
          console.warn("[cutting-lists/POST] no warehouse configured — skipping stock deduction");
        }

        if (warehouseId && sheetsNeeded > 0) {
          await db.$transaction(async (tx) => {
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
                entityType: "settings",
                entityId: inv.id,
                actor: session,
                summary: `Auto-deducted ${sheetsNeeded} ${inv.unit} from ${inv.name} (cutting list for ${item.job?.orderNumber})`,
                details: {
                  inventoryItem: inv.name,
                  deducted: sheetsNeeded,
                  previousStock: Number(inv.stockLevel).toString(),
                  newStock: Number(totalAgg._sum.quantity ?? 0).toString(),
                  cuttingListId: item.id,
                  warehouseId,
                },
              });
            }
          });
        }
      }
    } catch (err) {
      console.error("[cutting-lists/POST] inventory auto-deduct failed:", err);
    }
  }

  return NextResponse.json({ cuttingList: item }, { status: 201 });
});
