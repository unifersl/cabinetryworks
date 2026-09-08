import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/search?q=<query>
 * Global search across jobs, customers, and users.
 * Returns grouped results limited to 5 per category.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  if (!q || q.length < 1) {
    return NextResponse.json({ jobs: [], customers: [], users: [] });
  }

  const isAdmin = session.role === "Admin" || session.role === "SuperAdmin";

  const [jobs, customers, users] = await Promise.all([
    db.jobOrder.findMany({
      where: {
        OR: [
          { title: { contains: q } },
          { orderNumber: { contains: q } },
          { description: { contains: q } },
        ],
      },
      take: 5,
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
          { email: { contains: q } },
          { phone: { contains: q } },
          { address: { contains: q } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
      },
    }),
    isAdmin
      ? db.user.findMany({
          where: {
            OR: [
              { username: { contains: q } },
              { fullName: { contains: q } },
              { email: { contains: q } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            status: true,
          },
        })
      : Promise.resolve([]),
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
    users,
  });
}
