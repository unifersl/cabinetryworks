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
  const warehouse = await db.warehouse.findUnique({
    where: { id },
    include: {
      stockLots: {
        include: { item: true },
        orderBy: { receivedDate: "desc" },
      },
      _count: {
        select: {
          transfersFrom: true,
          transfersTo: true,
          stockRequests: true,
          issues: true,
          returns: true,
        },
      },
    },
  });

  if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ warehouse });
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
  for (const k of ["code", "name", "location", "type"]) {
    if (body[k] !== undefined) {
      data[k] = k === "code" ? String(body[k]).trim().toUpperCase() : String(body[k]).trim();
    }
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const warehouse = await db.warehouse.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated warehouse ${warehouse.code}`,
  });

  return NextResponse.json({ warehouse });
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
  const warehouse = await db.warehouse.findUnique({ where: { id } });
  if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check for related records
  const lotCount = await db.stockLot.count({ where: { warehouseId: id, quantity: { gt: 0 } } });
  if (lotCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete warehouse with active stock lots. Transfer or zero out stock first." },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted warehouse ${warehouse.code}`,
  });

  await db.warehouse.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
