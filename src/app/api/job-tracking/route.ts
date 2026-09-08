import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

/**
 * GET /api/job-tracking
 * Query params:
 *   customerId=xxx  — filter by customer
 *   jobType=Repair   — filter by job type
 *   from=2026-01-01  — date range start
 *   to=2026-12-31    — date range end
 *   groupBy=customer|jobType|month|status
 * 
 * Returns a unified tracking view: all jobs for a customer across multiple
 * projects, including repairs, touch-ups, add-ons, modifications.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const jobType = searchParams.get("jobType");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const groupBy = searchParams.get("groupBy") || "customer";

  // Build where clause
  const where: Record<string, unknown> = { archived: false };
  if (customerId) where.customerId = customerId;
  if (jobType) where.jobType = jobType;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = toDate;
    }
  }

  // Fetch all matching jobs with customer + parent job info
  const jobs = await db.jobOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, address: true } },
      assignedTo: { select: { id: true, fullName: true } },
      parentJob: { select: { id: true, orderNumber: true, title: true } },
      _count: {
        select: {
          measurements: true,
          cuttingLists: true,
          quotes: true,
          goodsIssues: true,
          goodsReturns: true,
        },
      },
    },
  });

  // Build response based on groupBy
  if (groupBy === "customer") {
    // Group by customer
    const customerMap = new Map<string, {
      customer: { id: string; name: string; phone: string | null; email: string | null; address: string | null };
      jobs: typeof jobs;
      totalJobs: number;
      jobTypes: Record<string, number>;
      latestJob: string | null;
    }>();

    for (const job of jobs) {
      const cId = job.customerId;
      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          customer: job.customer,
          jobs: [],
          totalJobs: 0,
          jobTypes: {},
          latestJob: null,
        });
      }
      const entry = customerMap.get(cId)!;
      entry.jobs.push(job);
      entry.totalJobs++;
      entry.jobTypes[job.jobType] = (entry.jobTypes[job.jobType] ?? 0) + 1;
      if (!entry.latestJob || new Date(job.createdAt) > new Date(entry.latestJob)) {
        entry.latestJob = job.createdAt.toISOString();
      }
    }

    // Sort customers by most recent activity
    const grouped = Array.from(customerMap.values()).sort((a, b) =>
      new Date(b.latestJob ?? 0).getTime() - new Date(a.latestJob ?? 0).getTime()
    );

    return NextResponse.json({
      groupBy: "customer",
      totalJobs: jobs.length,
      totalCustomers: grouped.length,
      groups: grouped,
    });
  }

  if (groupBy === "jobType") {
    // Group by job type
    const typeMap = new Map<string, typeof jobs>();
    for (const job of jobs) {
      if (!typeMap.has(job.jobType)) typeMap.set(job.jobType, []);
      typeMap.get(job.jobType)!.push(job);
    }
    const grouped = Array.from(typeMap.entries()).map(([type, typeJobs]) => ({
      jobType: type,
      jobs: typeJobs,
      count: typeJobs.length,
    }));
    return NextResponse.json({
      groupBy: "jobType",
      totalJobs: jobs.length,
      groups: grouped,
    });
  }

  if (groupBy === "month") {
    // Group by month (YYYY-MM)
    const monthMap = new Map<string, typeof jobs>();
    for (const job of jobs) {
      const monthKey = job.createdAt.toISOString().slice(0, 7);
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
      monthMap.get(monthKey)!.push(job);
    }
    const grouped = Array.from(monthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, monthJobs]) => ({
        month,
        jobs: monthJobs,
        count: monthJobs.length,
      }));
    return NextResponse.json({
      groupBy: "month",
      totalJobs: jobs.length,
      groups: grouped,
    });
  }

  // Default: flat list
  return NextResponse.json({
    groupBy: "none",
    totalJobs: jobs.length,
    jobs,
  });
});
