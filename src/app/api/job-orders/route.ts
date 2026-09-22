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

  // Pagination params — backward compatible:
  //   • If NEITHER `q` NOR `page` is provided, return ALL jobs (existing behavior).
  //     This protects Overview stats queries and any other caller that expects the full list.
  //   • If `page` is provided, enable paginated mode (default page size 50, max 200).
  //   • If `q` is provided (server-side search), filter at DB level by title/orderNumber.
  const q = searchParams.get("q")?.trim() ?? "";
  const pageProvided = searchParams.has("page");
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = assignedToId;
  if (archivedOnly) {
    where.archived = true;
  } else if (!includeArchived) {
    where.archived = false;
  }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { orderNumber: { contains: q } },
    ];
  }

  const paginate = pageProvided || q.length > 0;
  const jobs = await db.jobOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true, role: true } },
      _count: { select: { measurements: true, cuttingLists: true } },
    },
    ...(paginate ? { take, skip } : {}),
  });
  return NextResponse.json({
    jobs,
    ...(paginate ? { page, take, total: await db.jobOrder.count({ where }) } : {}),
  });
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

  // Validate jobType if provided
  const VALID_JOB_TYPES = ["New", "Installation", "Repair", "Touch-Up", "Add-On", "Modification", "Warranty"];
  const jobType = body?.jobType ? String(body.jobType) : "New";
  if (!VALID_JOB_TYPES.includes(jobType)) {
    return NextResponse.json({ error: "Invalid job type" }, { status: 400 });
  }

  // For non-New job types, parentJobId is recommended (links to original job)
  const parentJobId = body?.parentJobId ? String(body.parentJobId) : null;
  if (parentJobId && jobType === "New") {
    return NextResponse.json({ error: "Parent job is only for non-New job types" }, { status: 400 });
  }

  // Generate a human-friendly order number (retry on collision)
  let orderNumber = "";
  let attempts = 0;
  while (attempts < 5) {
    const count = await db.jobOrder.count();
    orderNumber = `KCM-${String(count + 1 + attempts).padStart(5, "0")}`;
    const exists = await db.jobOrder.findUnique({ where: { orderNumber }, select: { id: true } });
    if (!exists) break;
    attempts++;
  }

  const job = await db.jobOrder.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      orderNumber,
      title,
      customerId,
      jobType,
      parentJobId,
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
