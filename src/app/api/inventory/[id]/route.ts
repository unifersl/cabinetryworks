import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canDeleteStock, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const k of ["name", "code", "material", "thickness", "unit", "supplier", "status", "notes"]) {
    if (body[k] !== undefined) {
      data[k] = body[k] === "" || body[k] === null ? null : String(body[k]);
    }
  }
  for (const k of ["stockLevel", "minStock", "reorderPoint", "unitCost"]) {
    if (body[k] !== undefined) data[k] = Number(body[k]);
  }
  if (body.categoryId !== undefined) {
    data.categoryId = body.categoryId ? String(body.categoryId) : null;
  }
  if (body.lastRestocked !== undefined) {
    data.lastRestocked = body.lastRestocked ? new Date(body.lastRestocked) : null;
  }

  // If stock level changed, record restock date
  if (body.stockLevel !== undefined && Number(body.stockLevel) > 0) {
    data.lastRestocked = new Date();
  }

  const item = await db.inventoryItem.update({
    where: { id },
    data,
    include: { category: true },
  });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated inventory: ${item.name} (stock: ${item.stockLevel})`,
  });

  // Serialize Decimal fields to numbers for consistent JSON response
  return NextResponse.json({
    item: {
      ...item,
      stockLevel: Number(item.stockLevel),
      minStock: Number(item.minStock),
      reorderPoint: Number(item.reorderPoint),
      unitCost: Number(item.unitCost),
    },
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Delete/dispose requires admin or manager permission (storekeeper cannot delete)
  if (!canDeleteStock(session.role))
    return NextResponse.json({ error: "Forbidden — deleting stock items requires admin or manager permission" }, { status: 403 });

  const { id } = await params;
  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted inventory item: ${item.name}`,
  });
  await db.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
