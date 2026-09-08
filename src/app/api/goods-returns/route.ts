import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateReturnNo(): Promise<string> {
  const count = await db.goodsReturn.count();
  const year = new Date().getFullYear();
  return `GR-${year}-${String(count + 1).padStart(4, "0")}`;
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

  const returns = await db.goodsReturn.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  return NextResponse.json({
    returns: returns.map((r) => ({ ...r, lineCount: r.lines.length })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = canManageUsers(session.role);
  const body = await req.json();
  const warehouseId = String(body?.warehouseId ?? "");
  const jobId = body?.jobId ? String(body.jobId) : null;
  const issueId = body?.issueId ? String(body.issueId) : null;
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const notes = body?.notes ? String(body.notes).trim() : "";

  if (!warehouseId) {
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one item" }, { status: 400 });
  }

  // Job is required UNLESS admin provides a reason
  if (!jobId) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "A job/project is required for goods return." },
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

  // If linked to an issue, verify the return's job matches the issue's job
  if (issueId) {
    const issue = await db.goodsIssue.findUnique({ where: { id: issueId }, select: { jobId: true } });
    if (!issue) return NextResponse.json({ error: "Original issue not found" }, { status: 404 });
    if (issue.jobId && issue.jobId !== jobId) {
      return NextResponse.json(
        { error: "The return must be for the same job/project as the original goods issue." },
        { status: 400 }
      );
    }
  }

  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });

  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Validate: each returned item must have been previously issued or purchased for this job
  // Admin override: skip this validation entirely (admin can return ANY item with reason)
  if (jobId && !isAdmin) {
  const issuesForJob = await db.goodsIssue.findMany({
    where: { jobId },
    include: { lines: true },
  });
  const issuedMap = new Map<string, number>(); // itemId → total issued qty
  for (const iss of issuesForJob) {
    for (const line of iss.lines) {
      const q = Number(line.quantity) || 0;
      issuedMap.set(line.itemId, (issuedMap.get(line.itemId) ?? 0) + q);
    }
  }
  // Subtract already-returned quantities
  const returnsForJob = await db.goodsReturn.findMany({
    where: { jobId },
    include: { lines: true },
  });
  for (const ret of returnsForJob) {
    for (const line of ret.lines) {
      const q = Number(line.quantity) || 0;
      issuedMap.set(line.itemId, (issuedMap.get(line.itemId) ?? 0) - q);
    }
  }
  // Also add outside-purchased items (received) for this job
  const outsideForJob = await db.outsidePurchase.findMany({
    where: { jobId, status: "received" },
    include: { lines: true },
  });
  for (const op of outsideForJob) {
    for (const line of op.lines) {
      if (!line.itemId) continue; // skip unlinked items
      const q = Number(line.quantity) || 0;
      issuedMap.set(line.itemId, (issuedMap.get(line.itemId) ?? 0) + q);
    }
  }

  // Validate each returned line
  for (const line of linesRaw) {
    const itemId = String(line.itemId);
    const qty = Number(line.quantity) || 0;
    if (qty <= 0) continue;
    const available = issuedMap.get(itemId) ?? 0;
    if (available <= 0) {
      const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
      return NextResponse.json(
        { error: `Item "${item?.name ?? itemId}" was not issued or purchased for this job. Returns must be for items previously issued or purchased for the exact same job.` },
        { status: 400 }
      );
    }
    if (qty > available) {
      const item = await db.inventoryItem.findUnique({ where: { id: itemId } });
      return NextResponse.json(
        { error: `Return quantity ${qty} for "${item?.name ?? itemId}" exceeds available ${available}. Only ${available} units can be returned (issued minus already returned).` },
        { status: 400 }
      );
    }
  }
  } // end if (jobId && !isAdmin)

  const returnNo = await generateReturnNo();

  const goodsReturn = await db.$transaction(async (tx) => {
    const ret = await tx.goodsReturn.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        returnNo,
        jobId,
        warehouseId,
        issueId,
        returnedBy: session.id,
        status: "returned",
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

    // Add stock back to warehouse lots and update item totals
    for (const line of ret.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;
      const existingLot = await tx.stockLot.findFirst({
        where: { itemId: line.itemId, warehouseId, batchNo: line.batchNo ?? null },
      });
      if (existingLot) {
        await tx.stockLot.update({
          where: { id: existingLot.id },
          data: { quantity: Number(existingLot.quantity) + qty, receivedDate: new Date() },
        });
      } else {
        await tx.stockLot.create({
          data: {
            id: randomUUID(),
            itemId: line.itemId,
            warehouseId,
            quantity: qty,
            batchNo: line.batchNo ?? null,
            receivedDate: new Date(),
          },
        });
      }

      const totalAgg = await tx.stockLot.aggregate({
        where: { itemId: line.itemId },
        _sum: { quantity: true },
      });
      await tx.inventoryItem.update({
        where: { id: line.itemId },
        data: {
          stockLevel: Number(totalAgg._sum.quantity ?? 0),
          lastRestocked: new Date(),
        },
      });
    }

    return ret;
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: goodsReturn.id,
    actor: session,
    summary: `Created goods return ${returnNo}`,
    details: { returnNo, warehouseId, jobId, issueId, lineCount: linesRaw.length },
  });

  return NextResponse.json(
    { return: { ...goodsReturn, lineCount: goodsReturn.lines.length } },
    { status: 201 }
  );
});
