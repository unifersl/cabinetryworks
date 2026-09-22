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
  for (const k of ["name", "contactName", "email", "phone", "address", "website", "paymentTerms", "notes"]) {
    if (body[k] !== undefined) data[k] = body[k] ? String(body[k]) : null;
  }

  const supplier = await db.supplier.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated supplier: ${supplier.name}`,
  });

  return NextResponse.json({ supplier });
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
  const supplier = await db.supplier.findUnique({ where: { id } });
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Integrity guard: both InventoryItem.supplier and PurchaseOrder.supplier are
  // free-text columns referencing the supplier by name. Deleting the supplier
  // would orphan those references. Refuse delete if any rows still point at it.
  const [invRefs, poRefs] = await Promise.all([
    db.inventoryItem.findMany({ where: { supplier: supplier.name }, select: { id: true } }),
    db.purchaseOrder.findMany({ where: { supplier: supplier.name }, select: { id: true } }),
  ]);

  if (invRefs.length > 0 || poRefs.length > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: supplier is referenced by ${invRefs.length} inventory items and ${poRefs.length} purchase orders`,
      },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted supplier: ${supplier.name}`,
  });
  await db.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
