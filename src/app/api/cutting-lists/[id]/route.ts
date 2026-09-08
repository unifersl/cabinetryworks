import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Find the main warehouse to restore cutting-list stock to.
 * Falls back to any active warehouse if no "main" type is configured.
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const cl = await db.cuttingList.findUnique({ where: { id } });
  if (!cl) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageUsers(session.role) && cl.createdById !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reverse inventory deduction: restore stock that was deducted when this
  // cutting list was created. Previously this added directly to
  // InventoryItem.stockLevel, bypassing the StockLot source-of-truth. Now
  // we add back to StockLot in the main warehouse and recalc the item total.
  if (cl.items && cl.material) {
    try {
      let items: Array<{ part: string; qty: number; length: string; width: string; thickness: string; edge?: string }> = [];
      try {
        items = cl.items ? JSON.parse(cl.items) : [];
      } catch {
        items = [];
      }

      if (items.length > 0) {
        const materialName = cl.material;
        const invItems = await db.inventoryItem.findMany({
          where: { material: { contains: materialName } },
        });

        if (invItems.length > 0) {
          // Get configurable sheet size from settings (default 2.88 m² = 2400×1200mm)
          const sheetSizeSetting = await db.systemSetting.findUnique({
            where: { key: "sheet_size_sqm" },
          });
          const sheetSizeSqm = sheetSizeSetting?.value
            ? Number(sheetSizeSetting.value)
            : 2.88;

          let totalAreaSqm = 0;
          for (const it of items) {
            const lengthMm = parseFloat(it.length) || 0;
            const widthMm = parseFloat(it.width) || 0;
            const qty = Number(it.qty) || 1;
            totalAreaSqm += (lengthMm * widthMm * qty) / 1_000_000;
          }
          const sheetsToRestore = Math.ceil(totalAreaSqm / sheetSizeSqm);

          const warehouseId = await findDefaultWarehouseId();
          if (!warehouseId) {
            console.warn("[cutting-lists/DELETE] no warehouse configured — skipping stock restore");
          }

          if (warehouseId && sheetsToRestore > 0) {
            await db.$transaction(async (tx) => {
              for (const inv of invItems) {
                // Restore to an existing lot for this warehouse (or create a new one)
                const existingLot = await tx.stockLot.findFirst({
                  where: { itemId: inv.id, warehouseId },
                });
                if (existingLot) {
                  await tx.stockLot.update({
                    where: { id: existingLot.id },
                    data: {
                      quantity: Number(existingLot.quantity) + sheetsToRestore,
                      receivedDate: new Date(),
                    },
                  });
                } else {
                  await tx.stockLot.create({
                    data: {
                      id: randomUUID(),
                      itemId: inv.id,
                      warehouseId,
                      quantity: sheetsToRestore,
                      receivedDate: new Date(),
                      notes: `Restored from deleted cutting list ${id}`,
                    },
                  });
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
                  summary: `Restored ${sheetsToRestore} ${inv.unit} to ${inv.name} (cutting list deleted)`,
                  details: {
                    inventoryItem: inv.name,
                    restored: sheetsToRestore,
                    previousStock: Number(inv.stockLevel).toString(),
                    newStock: Number(totalAgg._sum.quantity ?? 0).toString(),
                    cuttingListId: id,
                    warehouseId,
                  },
                });
              }
            });
          }
        }
      }
    } catch (err) {
      console.error("[cutting-lists/DELETE] inventory restore failed:", err);
    }
  }

  await recordAudit({
    action: "delete",
    entityType: "cutting_list",
    entityId: id,
    actor: session,
    summary: `Deleted cutting list: ${cl.panelName ?? "List"}`,
    details: { jobId: cl.jobId, material: cl.material, panelName: cl.panelName },
  });
  await db.cuttingList.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
