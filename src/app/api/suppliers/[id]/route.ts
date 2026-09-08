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
