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
  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: {
      warehouse: true,
      lines: { include: { item: true } },
    },
  });

  if (!stockTake) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    stockTake: {
      ...stockTake,
      lineCount: stockTake.lines.length,
    },
  });
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

  const stockTake = await db.stockTake.findUnique({
    where: { id },
    include: { warehouse: true, lines: { include: { item: true } } },
  });
  if (!stockTake) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If body has `lines` (array of {lineId, countedQty}), update them and recompute diff
  const linesInput = Array.isArray(body?.lines) ? body.lines : null;
  const newStatus = body?.status ? String(body.status) : undefined;

  await db.$transaction(async (tx) => {
    if (linesInput) {
      for (const line of linesInput) {
        const lineId = String(line.lineId);
        const countedQty = Number(line.countedQty) || 0;
        const existing = stockTake.lines.find((l) => l.id === lineId);
        if (!existing) continue;
        const systemQty = Number(existing.systemQty);
        const diff = countedQty - systemQty;
        await tx.stockTakeLine.update({
          where: { id: lineId },
          data: { countedQty, diff },
        });
      }
    }

    const data: Record<string, unknown> = {};
    if (newStatus) data.status = newStatus;
    if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

    // If completing, apply adjustments to stock lots
    if (newStatus === "completed" && stockTake.status !== "completed") {
      data.closedAt = new Date();
      const refreshedLines = linesInput
        ? await tx.stockTakeLine.findMany({ where: { takeId: id } })
        : stockTake.lines;

      for (const line of refreshedLines) {
        const diff = Number(line.diff);
        if (diff === 0) continue;

        const itemId = line.itemId;
        const warehouseId = stockTake.warehouseId;

        if (diff < 0) {
          // Reduce stock FIFO
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
          // Increase stock
          const existingLot = await tx.stockLot.findFirst({
            where: { itemId, warehouseId, quantity: { gt: 0 } },
            orderBy: { receivedDate: "desc" },
          });
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
              },
            });
          }
        }

        // Update item total
        const totalAgg = await tx.stockLot.aggregate({
          where: { itemId },
          _sum: { quantity: true },
        });
        await tx.inventoryItem.update({
          where: { id: itemId },
          data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
        });

        // Record an adjustment for this line
        await tx.stockAdjustment.create({
          data: {
            id: randomUUID(),
            adjNo: `ADJ-STK-${id.slice(0, 8)}-${itemId.slice(0, 4)}`,
            itemId,
            warehouseId,
            type: "set",
            oldQty: Number(line.systemQty),
            newQty: Number(line.countedQty),
            diff,
            reason: "stock_take",
            notes: `Auto-generated from stock take ${stockTake.takeNo}`,
            adjustedBy: session.id,
          },
        });
      }
    }

    await tx.stockTake.update({ where: { id }, data });
    await recordAudit({
      action: "update",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Stock take ${stockTake.takeNo} updated${newStatus ? ` → ${newStatus}` : ""}`,
    });
  });

  const refreshed = await db.stockTake.findUnique({
    where: { id },
    include: { warehouse: true, lines: { include: { item: true } } },
  });

  return NextResponse.json({
    stockTake: refreshed ? { ...refreshed, lineCount: refreshed.lines.length } : null,
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
  const stockTake = await db.stockTake.findUnique({ where: { id } });
  if (!stockTake) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (stockTake.status === "completed" || stockTake.status === "closed") {
    return NextResponse.json(
      { error: "Cannot delete a completed/closed stock take" },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted stock take ${stockTake.takeNo}`,
  });
  await db.stockTake.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
