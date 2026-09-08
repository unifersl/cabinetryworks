import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateReqNo(): Promise<string> {
  const count = await db.stockRequest.count();
  const year = new Date().getFullYear();
  return `REQ-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const warehouseId = searchParams.get("warehouseId");
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (warehouseId) where.warehouseId = warehouseId;
  if (jobId) where.jobId = jobId;

  const requests = await db.stockRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  return NextResponse.json({
    requests: requests.map((r) => ({ ...r, lineCount: r.lines.length })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = canManageUsers(session.role);
  if (!canManageStock(session.role)) return NextResponse.json({ error: "Forbidden — stock operations require admin, manager, or storekeeper role" }, { status: 403 });
  const body = await req.json();
  const warehouseId = String(body?.warehouseId ?? "");
  const jobId = body?.jobId ? String(body.jobId) : null;
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const notes = body?.notes ? String(body.notes).trim() : "";

  if (!warehouseId) {
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one item" }, { status: 400 });
  }

  // Job is required for technicians. Admins may override (skip the job) ONLY
  // if they provide a textual reason (>= 5 chars) explaining why stock is being
  // requested without a linked project/job.
  if (!jobId) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "A job/project is required for stock requests. Please select a job." },
        { status: 400 }
      );
    }
    if (notes.length < 5) {
      return NextResponse.json(
        { error: "Admin override requires a reason (min 5 chars) when no job is linked." },
        { status: 400 }
      );
    }
  }

  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  // Validate the linked job exists (only when a job is provided)
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const reqNo = await generateReqNo();

  const stockRequest = await db.stockRequest.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      reqNo,
      jobId,
      warehouseId,
      requestedBy: session.id,
      status: "pending",
      notes: notes || null,
      lines: {
        create: linesRaw.map((line: Record<string, unknown>) => ({
          id: randomUUID(),
          itemId: String(line.itemId),
          quantity: Number(line.quantity) || 0,
        })),
      },
    },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: stockRequest.id,
    actor: session,
    summary: `Created stock request ${reqNo} for job`,
    details: { reqNo, warehouseId, jobId, lineCount: linesRaw.length, notes },
  });

  return NextResponse.json(
    { request: { ...stockRequest, lineCount: stockRequest.lines.length } },
    { status: 201 }
  );
});
