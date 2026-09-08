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

  const existing = await db.siteVisit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.jobId !== undefined) data.jobId = body.jobId ? String(body.jobId) : null;
  if (body.visitorName !== undefined) data.visitorName = String(body.visitorName);
  if (body.visitDate !== undefined) data.visitDate = new Date(body.visitDate);
  if (body.purpose !== undefined) data.purpose = String(body.purpose);
  if (body.observations !== undefined) data.observations = body.observations ? String(body.observations) : null;
  if (body.photos !== undefined) data.photos = typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos);
  if (body.actionItems !== undefined) data.actionItems = typeof body.actionItems === "string" ? String(body.actionItems) : JSON.stringify(body.actionItems);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const visit = await db.siteVisit.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "site_visit",
    entityId: id,
    actor: session,
    summary: `Updated site visit by ${visit.visitorName}`,
    details: { visitId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ visit });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.siteVisit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.siteVisit.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "site_visit",
    entityId: id,
    actor: session,
    summary: `Deleted site visit by ${existing.visitorName}`,
    details: { visitId: id, jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
