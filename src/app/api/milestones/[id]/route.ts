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

  const existing = await db.milestone.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.targetDate !== undefined) data.targetDate = new Date(body.targetDate);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  // Status workflow — auto-stamp achievedDate when transitioning to achieved
  if (body.status !== undefined) {
    const newStatus = String(body.status);
    data.status = newStatus;
    if (newStatus === "achieved" && existing.status !== "achieved") {
      data.achievedDate = body.achievedDate ? new Date(body.achievedDate) : new Date();
    } else if (body.achievedDate !== undefined) {
      data.achievedDate = body.achievedDate ? new Date(body.achievedDate) : null;
    }
  } else if (body.achievedDate !== undefined) {
    data.achievedDate = body.achievedDate ? new Date(body.achievedDate) : null;
  }

  const milestone = await db.milestone.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "milestone",
    entityId: id,
    actor: session,
    summary: `Updated milestone "${milestone.name}" (${milestone.status})`,
    details: { milestoneId: id, jobId: existing.jobId, changes: Object.keys(data) },
  });

  return NextResponse.json({ milestone });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.milestone.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.milestone.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "milestone",
    entityId: id,
    actor: session,
    summary: `Deleted milestone "${existing.name}"`,
    details: { milestoneId: id, jobId: existing.jobId, name: existing.name },
  });

  return NextResponse.json({ ok: true });
});
