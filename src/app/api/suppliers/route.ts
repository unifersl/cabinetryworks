import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
  });

  // Count inventory items per supplier by name match
  const inventoryItems = await db.inventoryItem.findMany({
    select: { supplier: true },
  });
  const invCountMap = new Map<string, number>();
  for (const item of inventoryItems) {
    if (item.supplier) {
      invCountMap.set(
        item.supplier,
        (invCountMap.get(item.supplier) ?? 0) + 1
      );
    }
  }

  // Count POs per supplier
  const poCountRows = await db.purchaseOrder.groupBy({
    by: ["supplier"],
    _count: true,
  });
  const poCountMap = new Map<string, number>();
  for (const row of poCountRows) {
    poCountMap.set(row.supplier, row._count);
  }

  const suppliersWithStats = suppliers.map((s) => ({
    ...s,
    inventoryCount: invCountMap.get(s.name) ?? 0,
    poCount: poCountMap.get(s.name) ?? 0,
  }));

  return NextResponse.json({ suppliers: suppliersWithStats });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
  }

  const existing = await db.supplier.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Supplier already exists" }, { status: 409 });
  }

  const supplier = await db.supplier.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      contactName: body?.contactName ? String(body.contactName) : null,
      email: body?.email ? String(body.email) : null,
      phone: body?.phone ? String(body.phone) : null,
      address: body?.address ? String(body.address) : null,
      website: body?.website ? String(body.website) : null,
      paymentTerms: body?.paymentTerms ? String(body.paymentTerms) : null,
      notes: body?.notes ? String(body.notes) : null,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: supplier.id,
    actor: session,
    summary: `Created supplier: ${supplier.name}`,
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
