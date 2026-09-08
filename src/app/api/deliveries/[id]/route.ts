import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
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

  const existing = await db.deliveryRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.type !== undefined) data.type = String(body.type);
  if (body.scheduledDate !== undefined) data.scheduledDate = new Date(body.scheduledDate);
  if (body.completedDate !== undefined) data.completedDate = body.completedDate ? new Date(body.completedDate) : null;
  if (body.driverName !== undefined) data.driverName = body.driverName ? String(body.driverName) : null;
  if (body.vehicleNo !== undefined) data.vehicleNo = body.vehicleNo ? String(body.vehicleNo) : null;
  if (body.installTeam !== undefined) data.installTeam = body.installTeam ? String(body.installTeam) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.preChecklist !== undefined) data.preChecklist = typeof body.preChecklist === "string" ? String(body.preChecklist) : JSON.stringify(body.preChecklist);
  if (body.postChecklist !== undefined) data.postChecklist = typeof body.postChecklist === "string" ? String(body.postChecklist) : JSON.stringify(body.postChecklist);
  if (body.photos !== undefined) data.photos = typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos);
  if (body.customerSignoff !== undefined) data.customerSignoff = body.customerSignoff ? String(body.customerSignoff) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const delivery = await db.deliveryRecord.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Updated delivery record for ${delivery.job?.orderNumber ?? "job"} (${delivery.status})`,
    details: { deliveryId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ delivery });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.deliveryRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.deliveryRecord.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted delivery record (${existing.type})`,
    details: { deliveryId: id, jobId: existing.jobId, type: existing.type },
  });

  return NextResponse.json({ ok: true });
});
