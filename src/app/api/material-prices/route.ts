import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prices = await db.materialPrice.findMany({
    orderBy: { material: "asc" },
  });
  return NextResponse.json({ prices });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  const material = String(body?.material ?? "").trim();

  if (!name || !material) {
    return NextResponse.json(
      { error: "Name and material type are required" },
      { status: 400 }
    );
  }

  const existing = await db.materialPrice.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "A material price with this name already exists" },
      { status: 409 }
    );
  }

  const price = await db.materialPrice.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      material,
      thickness: body?.thickness ? String(body.thickness) : null,
      pricePerSqm: body?.pricePerSqm ? Number(body.pricePerSqm) : 0,
      unit: body?.unit ? String(body.unit) : "sqm",
      edgeBandingPricePerM: body?.edgeBandingPricePerM ? Number(body.edgeBandingPricePerM) : 0,
      laborRatePerHour: body?.laborRatePerHour ? Number(body.laborRatePerHour) : 0,
      estimatedHours: body?.estimatedHours ? Number(body.estimatedHours) : 0,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: price.id,
    actor: session,
    summary: `Created material price: ${price.name}`,
    details: { name, material, pricePerSqm: price.pricePerSqm.toString() },
  });

  return NextResponse.json({ price }, { status: 201 });
}
