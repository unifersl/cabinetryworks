import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const orders = await db.purchaseOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
    },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const supplier = String(body?.supplier ?? "").trim();
  if (!supplier) {
    return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
  }

  // Generate PO number
  const count = await db.purchaseOrder.count();
  const poNumber = `PO-${String(count + 1).padStart(5, "0")}`;

  // Get currency from settings
  const currencySetting = await db.systemSetting.findUnique({
    where: { key: "currency" },
  });
  const currency = currencySetting?.value ?? "USD";

  // Calculate total from items
  const items = Array.isArray(body?.items) ? body.items : [];
  let totalCost = 0;
  for (const item of items) {
    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0);
    totalCost += lineTotal;
  }

  const order = await db.purchaseOrder.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      poNumber,
      supplier,
      status: body?.status ? String(body.status) : "draft",
      notes: body?.notes ? String(body.notes) : null,
      totalCost,
      currency,
      expectedDate: body?.expectedDate ? new Date(body.expectedDate) : null,
      items: {
        create: items.map((item: Record<string, unknown>) => ({
          id: randomUUID(),
          inventoryItemId: item.inventoryItemId ? String(item.inventoryItemId) : null,
          itemName: String(item.itemName ?? ""),
          quantity: Number(item.quantity) || 0,
          unit: String(item.unit ?? "sheet"),
          unitCost: Number(item.unitCost) || 0,
          lineTotal: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0),
        })),
      },
    },
    include: { items: true },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: order.id,
    actor: session,
    summary: `Created purchase order ${order.poNumber} for ${supplier}`,
    details: { poNumber, supplier, totalCost: totalCost.toString(), itemCount: items.length },
  });

  return NextResponse.json({ order }, { status: 201 });
}
