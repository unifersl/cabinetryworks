import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const warehouses = await db.warehouse.findMany({
    orderBy: [{ code: "asc" }],
    include: {
      _count: {
        select: {
          stockLots: true,
          transfersFrom: true,
          transfersTo: true,
          stockRequests: true,
          issues: true,
          returns: true,
        },
      },
    },
  });

  // Compute distinct item count per warehouse
  const withCounts = await Promise.all(
    warehouses.map(async (w) => {
      const lotAgg = await db.stockLot.aggregate({
        where: { warehouseId: w.id, quantity: { gt: 0 } },
        _count: { _all: true },
      });
      return {
        ...w,
        itemCount: lotAgg._count._all,
      };
    })
  );

  return NextResponse.json({ warehouses: withCounts });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const code = String(body?.code ?? "").trim().toUpperCase();
  const name = String(body?.name ?? "").trim();

  if (!code || !name) {
    return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
  }

  const existing = await db.warehouse.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Warehouse code already exists" }, { status: 409 });
  }

  const warehouse = await db.warehouse.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      code,
      name,
      location: body?.location ? String(body.location) : null,
      type: body?.type ? String(body.type) : "main",
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: warehouse.id,
    actor: session,
    summary: `Created warehouse ${warehouse.code} — ${warehouse.name}`,
    details: { code, name, type: warehouse.type },
  });

  return NextResponse.json({ warehouse }, { status: 201 });
});
