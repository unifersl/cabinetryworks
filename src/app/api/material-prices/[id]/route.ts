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
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.material !== undefined) data.material = String(body.material);
  if (body.thickness !== undefined) data.thickness = body.thickness ? String(body.thickness) : null;
  if (body.pricePerSqm !== undefined) data.pricePerSqm = Number(body.pricePerSqm);
  if (body.unit !== undefined) data.unit = String(body.unit);
  if (body.edgeBandingPricePerM !== undefined) data.edgeBandingPricePerM = Number(body.edgeBandingPricePerM);
  if (body.laborRatePerHour !== undefined) data.laborRatePerHour = Number(body.laborRatePerHour);
  if (body.estimatedHours !== undefined) data.estimatedHours = Number(body.estimatedHours);

  const price = await db.materialPrice.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated material price: ${price.name}`,
  });

  return NextResponse.json({ price });
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
  const price = await db.materialPrice.findUnique({ where: { id } });
  if (!price) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted material price: ${price.name}`,
  });
  await db.materialPrice.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
