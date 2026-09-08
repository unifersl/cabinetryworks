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
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;
  if (type) where.type = type;

  const deliveries = await db.deliveryRecord.findMany({
    where,
    orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ deliveries });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const delivery = await db.deliveryRecord.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      type: body?.type ? String(body.type) : "delivery",
      scheduledDate: body?.scheduledDate ? new Date(body.scheduledDate) : new Date(),
      completedDate: body?.completedDate ? new Date(body.completedDate) : null,
      driverName: body?.driverName ? String(body.driverName) : null,
      vehicleNo: body?.vehicleNo ? String(body.vehicleNo) : null,
      installTeam: body?.installTeam ? String(body.installTeam) : null,
      status: body?.status ? String(body.status) : "scheduled",
      preChecklist: body?.preChecklist ? (typeof body.preChecklist === "string" ? String(body.preChecklist) : JSON.stringify(body.preChecklist)) : null,
      postChecklist: body?.postChecklist ? (typeof body.postChecklist === "string" ? String(body.postChecklist) : JSON.stringify(body.postChecklist)) : null,
      photos: body?.photos ? (typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos)) : null,
      customerSignoff: body?.customerSignoff ? String(body.customerSignoff) : null,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Delivery record (${delivery.type}) created for ${job.orderNumber}`,
    details: { deliveryId: delivery.id, jobId, type: delivery.type, status: delivery.status },
  });

  return NextResponse.json({ delivery }, { status: 201 });
});
