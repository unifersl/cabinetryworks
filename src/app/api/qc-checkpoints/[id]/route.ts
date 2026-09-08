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

  const existing = await db.qCCheckpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.stage !== undefined) data.stage = String(body.stage);
  if (body.inspector !== undefined) data.inspector = body.inspector ? String(body.inspector) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.checklist !== undefined) data.checklist = typeof body.checklist === "string" ? String(body.checklist) : JSON.stringify(body.checklist);
  if (body.photos !== undefined) data.photos = typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.inspectedAt !== undefined) data.inspectedAt = body.inspectedAt ? new Date(body.inspectedAt) : null;

  const checkpoint = await db.qCCheckpoint.update({
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
    summary: `Updated QC checkpoint "${checkpoint.stage}" (${checkpoint.status})`,
    details: { checkpointId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ checkpoint });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.qCCheckpoint.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.qCCheckpoint.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted QC checkpoint for stage "${existing.stage}"`,
    details: { checkpointId: id, jobId: existing.jobId, stage: existing.stage },
  });

  return NextResponse.json({ ok: true });
});
