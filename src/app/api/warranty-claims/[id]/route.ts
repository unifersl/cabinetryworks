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

  const existing = await db.warrantyClaim.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.jobId !== undefined) {
    // Allow nulling the job link; if a value is given, validate it
    if (body.jobId === null || body.jobId === "") {
      data.jobId = null;
    } else {
      const job = await db.jobOrder.findUnique({ where: { id: String(body.jobId) }, select: { id: true } });
      if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      data.jobId = String(body.jobId);
    }
  }
  if (body.claimDate !== undefined) data.claimDate = new Date(body.claimDate);
  if (body.issueType !== undefined) data.issueType = String(body.issueType);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.status !== undefined) data.status = String(body.status);
  if (body.resolvedAt !== undefined) data.resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
  if (body.resolution !== undefined) data.resolution = body.resolution ? String(body.resolution) : null;
  if (body.partsUsed !== undefined) data.partsUsed = typeof body.partsUsed === "string" ? String(body.partsUsed) : JSON.stringify(body.partsUsed);
  if (body.photos !== undefined) data.photos = typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos);

  // If status moves to resolved/rejected and no resolvedAt provided, stamp it
  if (body.status === "resolved" || body.status === "rejected") {
    if (data.resolvedAt === undefined && !existing.resolvedAt) {
      data.resolvedAt = new Date();
    }
  }

  const claim = await db.warrantyClaim.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "job",
    entityId: existing.jobId ?? undefined,
    actor: session,
    summary: `Updated warranty claim ${existing.claimNo} (${claim.status})`,
    details: { claimId: id, claimNo: existing.claimNo, changes: Object.keys(data) },
  });

  return NextResponse.json({ claim });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.warrantyClaim.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.warrantyClaim.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId ?? undefined,
    actor: session,
    summary: `Deleted warranty claim ${existing.claimNo}`,
    details: { claimId: id, claimNo: existing.claimNo, jobId: existing.jobId },
  });

  return NextResponse.json({ ok: true });
});
