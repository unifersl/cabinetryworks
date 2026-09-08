import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

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

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.expectedDate !== undefined)
    data.expectedDate = body.expectedDate ? new Date(body.expectedDate) : null;

  // If marking as received, restock inventory items + set receivedDate
  if (body.status === "received") {
    data.receivedDate = new Date();

    const order = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (order) {
      for (const item of order.items) {
        if (item.inventoryItemId) {
          const inv = await db.inventoryItem.findUnique({
            where: { id: item.inventoryItemId },
          });
          if (inv) {
            const newStock = Number(inv.stockLevel) + Number(item.quantity);
            await db.inventoryItem.update({
              where: { id: inv.id },
              data: { stockLevel: newStock, lastRestocked: new Date() },
            });
          }
        }
      }
    }
  }

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
