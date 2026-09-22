import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // Pagination params — backward compatible:
  //   • If NEITHER `q` NOR `page` is provided, return ALL customers (existing behavior).
  //     This protects Overview stats queries and any other caller that expects the full list.
  //   • If `page` is provided, enable paginated mode (default page size 50, max 200).
  //   • If `q` is provided (server-side search), filter at DB level by name/phone/email.
  const q = searchParams.get("q")?.trim() ?? "";
  const pageProvided = searchParams.has("page");
  const takeRaw = Number(searchParams.get("take") ?? "50");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50;
  const skip = (page - 1) * take;

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phone: { contains: q } },
      { email: { contains: q } },
    ];
  }

  const paginate = pageProvided || q.length > 0;
  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobOrders: true } } },
    ...(paginate ? { take, skip } : {}),
  });

  // Only compute total when paginated (avoid an extra count query for the
  // unpaginated backward-compat path that already returns everything).
  const total = paginate
    ? await db.customer.count({ where })
    : customers.length;

  return NextResponse.json({ customers, total, ...(paginate ? { page, take } : {}) });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  const customer = await db.customer.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      phone: body?.phone ? String(body.phone) : null,
      email: body?.email ? String(body.email) : null,
      address: body?.address ? String(body.address) : null,
      notes: body?.notes ? String(body.notes) : null,
    },
  });
  await recordAudit({
    action: "create",
    entityType: "customer",
    entityId: customer.id,
    actor: session,
    summary: `Customer ${customer.name} created by ${session.fullName}`,
    details: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
  });
  return NextResponse.json({ customer }, { status: 201 });
});
