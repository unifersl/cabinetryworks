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
  const purchase = await db.outsidePurchase.findUnique({
    where: { id },
    include: {
      job: true,
      warehouse: true,
      lines: { include: { item: true } },
    },
  });

  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ purchase: { ...purchase, lineCount: purchase.lines.length } });
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

  const purchase = await db.outsidePurchase.findUnique({
    where: { id },
    include: { warehouse: true, lines: { include: { item: true } } },
  });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = body?.status ? String(body.status) : purchase.status;
  const oldStatus = purchase.status;

  const data: Record<string, unknown> = {};
  if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body?.supplier !== undefined) data.supplier = body.supplier ? String(body.supplier) : null;
  data.status = newStatus;

  await db.$transaction(async (tx) => {
    // If being received, add stock to inventory for lines with linked items
    if (newStatus === "received" && oldStatus !== "received" && purchase.warehouseId) {
      data.receivedAt = new Date();
      for (const line of purchase.lines) {
        if (!line.itemId) continue;
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        const existingLot = await tx.stockLot.findFirst({
          where: { itemId: line.itemId, warehouseId: purchase.warehouseId },
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
              warehouseId: purchase.warehouseId!,
              quantity: qty,
              receivedDate: new Date(),
            },
          });
        }

        const totalAgg = await tx.stockLot.aggregate({
          where: { itemId: line.itemId },
          _sum: { quantity: true },
        });
        await tx.inventoryItem.update({
          where: { id: line.itemId },
          data: {
            stockLevel: Number(totalAgg._sum.quantity ?? 0),
            lastRestocked: new Date(),
          },
        });
      }
    }

    await tx.outsidePurchase.update({ where: { id }, data });
    await recordAudit({
      action: "update",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Outside purchase ${purchase.poNo}: ${oldStatus} → ${newStatus}`,
    });
  });

  const refreshed = await db.outsidePurchase.findUnique({
    where: { id },
    include: { job: true, warehouse: true, lines: { include: { item: true } } },
  });

  return NextResponse.json({
    purchase: refreshed ? { ...refreshed, lineCount: refreshed.lines.length } : null,
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
  const purchase = await db.outsidePurchase.findUnique({ where: { id } });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (purchase.status === "received") {
    return NextResponse.json(
      { error: "Cannot delete a received outside purchase" },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted outside purchase ${purchase.poNo}`,
  });
  await db.outsidePurchase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
