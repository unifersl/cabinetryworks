import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.jobTransport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.vehicleNo !== undefined) data.vehicleNo = body.vehicleNo ? String(body.vehicleNo) : null;
  if (body.driverName !== undefined) data.driverName = body.driverName ? String(body.driverName) : null;
  if (body.fromLocation !== undefined) data.fromLocation = body.fromLocation ? String(body.fromLocation) : null;
  if (body.toLocation !== undefined) data.toLocation = body.toLocation ? String(body.toLocation) : null;
  if (body.purpose !== undefined) data.purpose = String(body.purpose);
  if (body.distanceKm !== undefined) data.distanceKm = Number(body.distanceKm) || 0;
  if (body.cost !== undefined) data.cost = Number(body.cost) || 0;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const transport = await db.jobTransport.update({ where: { id }, data });
  return NextResponse.json({ transport: { ...transport, distanceKm: Number(transport.distanceKm), cost: Number(transport.cost) } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobTransport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobTransport.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
