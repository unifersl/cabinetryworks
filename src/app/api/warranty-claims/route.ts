import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateClaimNo(): Promise<string> {
  const count = await db.warrantyClaim.count();
  const year = new Date().getFullYear();
  return `WC-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");
  const issueType = searchParams.get("issueType");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;
  if (issueType) where.issueType = issueType;

  const claims = await db.warrantyClaim.findMany({
    where,
    orderBy: [{ claimDate: "desc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  // Enrich with customer name
  const customerIds = [
    ...new Set(claims.map((c) => c.job?.customerId).filter(Boolean) as string[]),
  ];
  const customers =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
  const custMap = new Map(customers.map((c) => [c.id, c.name]));

  const result = claims.map((c) => ({
    ...c,
    job: c.job ? { ...c.job, customerName: custMap.get(c.job.customerId) ?? null } : c.job,
  }));

  return NextResponse.json({ claims: result });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const issueType = String(body?.issueType ?? "").trim();
  if (!issueType) return NextResponse.json({ error: "issueType is required" }, { status: 400 });

  // jobId is optional — warranty may be unlinked from a job
  const jobId = body?.jobId ? String(body.jobId).trim() || null : null;
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const claimNo = await generateClaimNo();

  const claim = await db.warrantyClaim.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      claimNo,
      claimDate: body?.claimDate ? new Date(body.claimDate) : new Date(),
      issueType,
      description: body?.description ? String(body.description) : null,
      status: body?.status ? String(body.status) : "open",
      resolvedAt: body?.resolvedAt ? new Date(body.resolvedAt) : null,
      resolution: body?.resolution ? String(body.resolution) : null,
      partsUsed: body?.partsUsed ? (typeof body.partsUsed === "string" ? String(body.partsUsed) : JSON.stringify(body.partsUsed)) : null,
      photos: body?.photos ? (typeof body.photos === "string" ? String(body.photos) : JSON.stringify(body.photos)) : null,
      createdBy: session.id,
    },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId ?? undefined,
    actor: session,
    summary: `Warranty claim ${claimNo} created (${issueType})${jobId ? "" : " — no job linked"}`,
    details: { claimId: claim.id, claimNo, jobId, issueType, status: claim.status },
  });

  return NextResponse.json({ claim }, { status: 201 });
});
