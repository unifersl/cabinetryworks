import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const transports = await db.jobTransport.findMany({
    where,
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ transports: transports.map((t) => ({ ...t, distanceKm: Number(t.distanceKm), cost: Number(t.cost) })) });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const transport = await db.jobTransport.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      date: body?.date ? new Date(body.date) : new Date(),
      vehicleNo: body?.vehicleNo ? String(body.vehicleNo) : null,
      driverName: body?.driverName ? String(body.driverName) : null,
      fromLocation: body?.fromLocation ? String(body.fromLocation) : null,
      toLocation: body?.toLocation ? String(body.toLocation) : null,
      purpose: body?.purpose ? String(body.purpose) : "material_delivery",
      distanceKm: body?.distanceKm !== undefined ? Number(body.distanceKm) || 0 : 0,
      cost: body?.cost !== undefined ? Number(body.cost) || 0 : 0,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Transport log: ${transport.vehicleNo ?? "Trip"} ${transport.distanceKm}km on ${job.orderNumber}`,
    details: { transportId: transport.id, jobId, purpose: transport.purpose, distanceKm: transport.distanceKm },
  });

  return NextResponse.json({ transport: { ...transport, distanceKm: Number(transport.distanceKm), cost: Number(transport.cost) } }, { status: 201 });
});
