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
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (type) where.type = type;

  const documents = await db.jobDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  return NextResponse.json({ documents });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const dataUrl = String(body?.dataUrl ?? "").trim();

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!dataUrl) return NextResponse.json({ error: "dataUrl is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Determine file type from data URL or name extension
  let fileType = body?.fileType ? String(body.fileType) : null;
  if (!fileType) {
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (match) fileType = match[1];
    else if (dataUrl.startsWith("data:")) {
      const m = dataUrl.match(/^data:([a-zA-Z0-9.+-]+)\//);
      fileType = m ? m[1] : null;
    }
  }

  // Compute version = current count for this job + 1 (immutable documents)
  const existingCount = await db.jobDocument.count({ where: { jobId, name } });
  const version = existingCount > 0 ? existingCount + 1 : 1;

  const document = await db.jobDocument.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      name,
      type: body?.type ? String(body.type) : "document",
      fileType: fileType ?? null,
      fileSize: body?.fileSize !== undefined ? Number(body.fileSize) || 0 : 0,
      dataUrl,
      version,
      notes: body?.notes ? String(body.notes) : null,
      uploadedBy: session.id,
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
    summary: `Uploaded document "${name}" (v${version}) for ${job.orderNumber}`,
    details: { documentId: document.id, jobId, name, type: document.type, fileType, version },
  });

  return NextResponse.json({ document }, { status: 201 });
});
