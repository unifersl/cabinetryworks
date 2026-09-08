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
  const status = searchParams.get("status");
  const assignedToId = searchParams.get("assignedToId");
  const includeArchived = searchParams.get("includeArchived") === "true";
  const archivedOnly = searchParams.get("archived") === "true";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (archivedOnly) {
    where.archived = true;
  } else if (!includeArchived) {
    where.archived = false;
  }

  const jobs = await db.jobOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true, role: true } },
      _count: { select: { measurements: true, cuttingLists: true } },
    },
  });
  return NextResponse.json({ jobs });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = String(body?.title ?? "").trim();
  const customerId = String(body?.customerId ?? "").trim();

  if (!title || !customerId) {
    return NextResponse.json(
      { error: "Title and customer are required" },
      { status: 400 }
    );
  }

  // Generate a human-friendly order number
  const count = await db.jobOrder.count();
  const orderNumber = `KCM-${String(count + 1).padStart(5, "0")}`;

  const job = await db.jobOrder.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      orderNumber,
      title,
      customerId,
      assignedToId: body?.assignedToId || null,
      description: body?.description ? String(body.description) : null,
      priority: body?.priority ? String(body.priority) : "Normal",
      status: "Pending",
      deliveryDate: body?.deliveryDate ? new Date(body.deliveryDate) : null,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  });
  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: job.id,
    actor: session,
    summary: `Created job ${job.orderNumber}: ${job.title}`,
    details: { orderNumber: job.orderNumber, priority: job.priority, customerId: job.customerId },
  });
  return NextResponse.json({ job }, { status: 201 });
});
