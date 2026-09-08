import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

/**
 * GET /api/global-search?q=<query>
 * Global search across jobs, customers, inventory items, suppliers,
 * workers, and job templates. Returns categorized results, max 5 per type.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(20, Number(searchParams.get("limit") ?? 5)));

  if (!q) {
    return NextResponse.json({
      jobs: [],
      customers: [],
      inventory: [],
      suppliers: [],
      workers: [],
      templates: [],
    });
  }

  const [jobs, customers, inventory, suppliers, workers, templates] = await Promise.all([
    // Jobs — by orderNumber or title; include customer name
    db.jobOrder.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q } },
          { title: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        priority: true,
        customerId: true,
      },
    }),

    db.customer.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, phone: true, email: true, address: true },
    }),

    db.inventoryItem.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { material: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        code: true,
        material: true,
        thickness: true,
        unit: true,
        stockLevel: true,
        status: true,
      },
    }),

    db.supplier.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { contactName: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, contactName: true, phone: true, email: true },
    }),

    db.worker.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { role: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, code: true, role: true, type: true, status: true },
    }),

    db.jobTemplate.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        estimatedDays: true,
        isActive: true,
      },
    }),
  ]);

  // Enrich jobs with customer names
  const customerIds = [...new Set(jobs.map((j) => j.customerId))];
  const jobCustomers =
    customerIds.length > 0
      ? await db.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
  const custMap = new Map(jobCustomers.map((c) => [c.id, c.name]));

  const jobsWithCustomer = jobs.map((j) => ({
    ...j,
    customerName: custMap.get(j.customerId) ?? null,
  }));

  return NextResponse.json({
    jobs: jobsWithCustomer,
    customers,
    inventory: inventory.map((i) => ({ ...i, stockLevel: Number(i.stockLevel) })),
    suppliers,
    workers,
    templates,
  });
});
