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

  const existing = await db.punchItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.category !== undefined) data.category = String(body.category);
  if (body.assignedTo !== undefined) data.assignedTo = body.assignedTo ? String(body.assignedTo) : null;
  if (body.photos !== undefined) data.photos = typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos);
  if (body.resolution !== undefined) data.resolution = body.resolution ? String(body.resolution) : null;

  // Status workflow — auto-stamp resolvedAt when transitioning to fixed/closed/verified
  if (body.status !== undefined) {
    const newStatus = String(body.status);
    const wasOpen = !["fixed", "verified", "closed"].includes(existing.status);
    const isResolved = ["fixed", "verified", "closed"].includes(newStatus);
    data.status = newStatus;
    if (isResolved && wasOpen && !existing.resolvedAt) {
      data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : new Date();
    } else if (body.resolvedAt !== undefined) {
      data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
    }
  } else if (body.resolvedAt !== undefined) {
    data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
  }

  const item = await db.punchItem.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "punch_item",
    entityId: id,
    actor: session,
    summary: `Updated punch item "${item.title}" (${item.status})`,
    details: { punchItemId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ item });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.punchItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.punchItem.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "punch_item",
    entityId: id,
    actor: session,
    summary: `Deleted punch item "${existing.title}"`,
    details: { punchItemId: id, jobId: existing.jobId, title: existing.title },
  });

  return NextResponse.json({ ok: true });
});
