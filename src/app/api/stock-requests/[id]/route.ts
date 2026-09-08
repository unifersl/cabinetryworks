import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateIssueNo(): Promise<string> {
  const count = await db.goodsIssue.count();
  const year = new Date().getFullYear();
  return `GI-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const stockRequest = await db.stockRequest.findUnique({
    where: { id },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  if (!stockRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ request: { ...stockRequest, lineCount: stockRequest.lines.length } });
});

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const newStatus = body?.status ? String(body.status) : null;

  if (!newStatus) {
    return NextResponse.json({ error: "Status is required" }, { status: 400 });
  }

  const stockRequest = await db.stockRequest.findUnique({
    where: { id },
    include: { warehouse: true, job: true, lines: { include: { item: true } } },
  });
  if (!stockRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const oldStatus = stockRequest.status;

  // When transitioning to "issued" (fulfilled), actually deduct stock from
  // the warehouse's StockLot (FIFO) and create a GoodsIssue for the audit
  // trail. Without this, the "issued" status was just a flag with no real
  // stock movement and InventoryItem.stockLevel was never updated.
  if (newStatus === "issued" && oldStatus !== "issued") {
    // Pre-validate stock availability for every requested line
    for (const line of stockRequest.lines) {
      const qty = Number(line.quantity);
      if (qty <= 0) continue;
      const lotAgg = await db.stockLot.aggregate({
        where: { itemId: line.itemId, warehouseId: stockRequest.warehouseId },
        _sum: { quantity: true },
      });
      const available = Number(lotAgg._sum.quantity ?? 0);
      if (available < qty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${line.item?.name ?? line.itemId}. Available: ${available}, requested: ${qty}`,
          },
          { status: 400 }
        );
      }
    }

    const issueNo = await generateIssueNo();

    await db.$transaction(async (tx) => {
      // Mark the request as issued
      await tx.stockRequest.update({
        where: { id },
        data: { status: "issued", updatedAt: new Date() },
      });

      // Create a GoodsIssue record for the audit trail
      const issue = await tx.goodsIssue.create({
        data: {
          id: randomUUID(),
          issueNo,
          jobId: stockRequest.jobId,
          warehouseId: stockRequest.warehouseId,
          requestId: stockRequest.id,
          issuedBy: session.id,
          status: "issued",
          notes: `Auto-issued from stock request ${stockRequest.reqNo}`,
          lines: {
            create: stockRequest.lines
              .filter((l) => Number(l.quantity) > 0)
              .map((line) => ({
                id: randomUUID(),
                itemId: line.itemId,
                quantity: Number(line.quantity),
              })),
          },
        },
      });

      // Deduct stock from warehouse lots (FIFO) and recalc item totals
      for (const line of stockRequest.lines) {
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        let remaining = qty;
        const lots = await tx.stockLot.findMany({
          where: { itemId: line.itemId, warehouseId: stockRequest.warehouseId, quantity: { gt: 0 } },
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

        // Recalculate InventoryItem.stockLevel from the new StockLot totals
        const totalAgg = await tx.stockLot.aggregate({
          where: { itemId: line.itemId },
          _sum: { quantity: true },
        });
        await tx.inventoryItem.update({
          where: { id: line.itemId },
          data: { stockLevel: Number(totalAgg._sum.quantity ?? 0) },
        });
      }

      await recordAudit({
        action: "status_change",
        entityType: "settings",
        entityId: id,
        actor: session,
        summary: `Stock request ${stockRequest.reqNo}: ${oldStatus} → issued (Goods Issue ${issue.issueNo} created)`,
        details: { issueId: issue.id, issueNo, requestId: id, oldStatus, newStatus },
      });
    });
  } else {
    // Non-issue status transitions — just update the flag.
    const data: Record<string, unknown> = { status: newStatus };
    if (newStatus === "approved") {
      data.approvedAt = new Date();
      data.approvedBy = session.id;
    }

    await db.stockRequest.update({ where: { id }, data });

    await recordAudit({
      action: "status_change",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Stock request ${stockRequest.reqNo}: ${oldStatus} → ${newStatus}`,
    });
  }

  const refreshed = await db.stockRequest.findUnique({
    where: { id },
    include: {
      warehouse: true,
      job: true,
      lines: { include: { item: true } },
    },
  });

  return NextResponse.json({
    request: refreshed ? { ...refreshed, lineCount: refreshed.lines.length } : null,
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const stockRequest = await db.stockRequest.findUnique({ where: { id } });
  if (!stockRequest) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (stockRequest.status === "issued") {
    return NextResponse.json(
      { error: "Cannot delete a request that has already been issued" },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted stock request ${stockRequest.reqNo}`,
  });
  await db.stockRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
