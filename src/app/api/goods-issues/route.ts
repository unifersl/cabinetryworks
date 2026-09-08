import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateIssueNo(): Promise<string> {
  const count = await db.goodsIssue.count();
  const year = new Date().getFullYear();
  return `GI-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get("warehouseId");
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (warehouseId) where.warehouseId = warehouseId;
  if (jobId) where.jobId = jobId;

  const issues = await db.goodsIssue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  return NextResponse.json({
    issues: issues.map((i) => ({ ...i, lineCount: i.lines.length })),
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
  const requestId = body?.requestId ? String(body.requestId) : null;
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const notes = body?.notes ? String(body.notes).trim() : "";

  // Job is required for technicians. Admins may override (skip the job) ONLY
  // if they provide a textual reason (>= 5 chars) explaining why stock is being
  // issued without a linked project/job.
  if (!jobId) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "A job/project is required for goods issues. Please select a job." },
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
  if (!warehouseId) {
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one item" }, { status: 400 });
  }

  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  // Validate the linked job exists (only when a job is provided)
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Validate stock availability
  for (const line of linesRaw) {
    const itemId = String(line.itemId);
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    const lotAgg = await db.stockLot.aggregate({
      where: { itemId, warehouseId },
      _sum: { quantity: true },
    });
    const available = Number(lotAgg._sum.quantity ?? 0);
    if (available < qty) {
      const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
      return NextResponse.json(
        { error: `Insufficient stock for ${item?.name ?? itemId}. Available: ${available}, needed: ${qty}` },
        { status: 400 }
      );
    }
  }

  const issueNo = await generateIssueNo();

  const goodsIssue = await db.$transaction(async (tx) => {
    const issue = await tx.goodsIssue.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        issueNo,
        jobId,
        warehouseId,
        requestId,
        issuedBy: session.id,
        status: "issued",
        notes: body?.notes ? String(body.notes) : null,
        lines: {
          create: linesRaw.map((line: Record<string, unknown>) => ({
            id: randomUUID(),
            itemId: String(line.itemId),
            quantity: Number(line.quantity) || 0,
            batchNo: line.batchNo ? String(line.batchNo) : null,
          })),
        },
      },
      include: {
        warehouse: true,
        job: true,
        lines: { include: { item: true } },
      },
    });

    // Deduct stock from warehouse lots (FIFO) and update item totals
    for (const line of issue.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;
      let remaining = qty;
      const lots = await tx.stockLot.findMany({
        where: { itemId: line.itemId, warehouseId, quantity: { gt: 0 } },
        orderBy: { receivedDate: "asc" },
      });
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(Number(lot.quantity), remaining);
        await tx.stockLot.update({
          where: { id: lot.id },
          data: { quantity: Number(lot.quantity) - take },
        });
        remaining -= take;
      }

      const totalAgg = await tx.stockLot.aggregate({
        where: { itemId: line.itemId },
        _sum: { quantity: true },
      });
      await tx.inventoryItem.update({
        where: { id: line.itemId },
        data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
      });
    }

    // If linked to a request, mark it as issued
    if (requestId) {
      await tx.stockRequest.update({
        where: { id: requestId },
        data: { status: "issued" },
      });
    }

    return issue;
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: goodsIssue.id,
    actor: session,
    summary: `Created goods issue ${issueNo}`,
    details: { issueNo, warehouseId, jobId, requestId, lineCount: linesRaw.length },
  });

  return NextResponse.json(
    { issue: { ...goodsIssue, lineCount: goodsIssue.lines.length } },
    { status: 201 }
  );
});
