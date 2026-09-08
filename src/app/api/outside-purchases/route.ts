import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers, canManageStock } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generatePoNo(): Promise<string> {
  const count = await db.outsidePurchase.count();
  const year = new Date().getFullYear();
  return `OP-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (jobId) where.jobId = jobId;

  const purchases = await db.outsidePurchase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: true,
      warehouse: true,
      lines: { include: { item: true } },
    },
  });

  return NextResponse.json({
    purchases: purchases.map((p) => ({ ...p, lineCount: p.lines.length })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageStock(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isAdmin = canManageUsers(session.role);
  const body = await req.json();
  const jobId = body?.jobId ? String(body.jobId) : null;
  const warehouseId = body?.warehouseId ? String(body.warehouseId) : null;
  const supplier = body?.supplier ? String(body.supplier) : null;
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const notes = body?.notes ? String(body.notes).trim() : "";

  // Job is required UNLESS admin provides a reason
  if (!jobId) {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "A job/project is required for outside purchases." },
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
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one line item" }, { status: 400 });
  }

  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (warehouseId) {
    const wh = await db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!wh) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  }

  const poNo = await generatePoNo();
  const status = body?.status ? String(body.status) : "draft";

  const purchase = await db.$transaction(async (tx) => {
    const op = await tx.outsidePurchase.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        poNo,
        jobId,
        warehouseId,
        supplier,
        purchasedBy: session.id,
        status,
        notes: body?.notes ? String(body.notes) : null,
        receivedAt: status === "received" ? new Date() : null,
        lines: {
          create: linesRaw.map((line: Record<string, unknown>) => ({
            id: randomUUID(),
            itemId: line.itemId ? String(line.itemId) : null,
            itemName: String(line.itemName ?? ""),
            quantity: Number(line.quantity) || 0,
            unit: String(line.unit ?? "pcs"),
            notes: line.notes ? String(line.notes) : null,
          })),
        },
      },
      include: {
        job: true,
        warehouse: true,
        lines: { include: { item: true } },
      },
    });

    // If received immediately, add to inventory for lines linked to inventory items
    if (status === "received" && warehouseId) {
      for (const line of op.lines) {
        if (!line.itemId) continue;
        const qty = Number(line.quantity);
        if (qty <= 0) continue;
        const existingLot = await tx.stockLot.findFirst({
          where: { itemId: line.itemId, warehouseId },
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
    }

    return op;
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: purchase.id,
    actor: session,
    summary: `Created outside purchase ${poNo}`,
    details: { poNo, jobId, warehouseId, supplier, lineCount: linesRaw.length, status },
  });

  return NextResponse.json(
    { purchase: { ...purchase, lineCount: purchase.lines.length } },
    { status: 201 }
  );
});
