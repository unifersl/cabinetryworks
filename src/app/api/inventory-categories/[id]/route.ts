import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const category = await db.inventoryCategory.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });

  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    category: { ...category, itemCount: category._count.items, _count: undefined },
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

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined)
    data.description = body.description ? String(body.description) : null;

  const category = await db.inventoryCategory.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated inventory category: ${category.name}`,
  });

  return NextResponse.json({ category });
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
  const category = await db.inventoryCategory.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unlink items (categoryId is nullable with SetNull)
  await db.inventoryItem.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted inventory category: ${category.name}`,
  });

  await db.inventoryCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
