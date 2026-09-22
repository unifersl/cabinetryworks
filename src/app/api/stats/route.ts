import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Date range parameter: 7, 30, or 90 days (default 7 to reduce memory)
  const { searchParams } = new URL(req.url);
  const rangeDays = Math.min(Math.max(Number(searchParams.get("range") ?? "7") || 7, 1), 90);

  const [users, activeUsers, jobOrders, pendingJobs, measurements, cuttingLists, customers, overdueJobs] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { status: "active" } }),
      db.jobOrder.count(),
      db.jobOrder.count({ where: { status: "Pending" } }),
      db.siteMeasurement.count(),
      db.cuttingList.count(),
      db.customer.count(),
      // Overdue = past delivery date AND not completed/cancelled AND not archived
      db.jobOrder.count({
        where: {
          deliveryDate: { lt: new Date() },
          status: { notIn: ["Completed", "Cancelled"] },
          archived: false,
        },
      }),
    ]);

  // Job status distribution
  const jobStatusRows = await db.jobOrder.groupBy({
    by: ["status"],
    _count: true,
  });
  const statusBreakdown = jobStatusRows.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.status] = r._count;
      return acc;
    },
    {}
  );

  // Priority distribution
  const priorityRows = await db.jobOrder.groupBy({
    by: ["priority"],
    _count: true,
  });
  const priorityBreakdown = priorityRows.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.priority] = r._count;
      return acc;
    },
    {}
  );

  // Throughput: jobs created per day over the selected range
  const since = new Date();
  since.setDate(since.getDate() - (rangeDays - 1));
  since.setHours(0, 0, 0, 0);
  const recentJobs = await db.jobOrder.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });
  const throughput: { date: string; created: number; completed: number }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    throughput.push({ date: key, created: 0, completed: 0 });
  }
  const idxMap = new Map(throughput.map((t, i) => [t.date, i]));
  for (const j of recentJobs) {
    const key = j.createdAt.toISOString().slice(0, 10);
    const idx = idxMap.get(key);
    if (idx !== undefined) throughput[idx].created += 1;
  }

  // Completed jobs over last 30 days (by updatedAt where status Completed)
  const recentCompleted = await db.jobOrder.findMany({
    where: { status: "Completed", updatedAt: { gte: since } },
    select: { updatedAt: true },
  });
  for (const j of recentCompleted) {
    const key = j.updatedAt.toISOString().slice(0, 10);
    const idx = idxMap.get(key);
    if (idx !== undefined) throughput[idx].completed += 1;
  }

  // Material usage breakdown (from cutting lists)
  const materialRows = await db.cuttingList.groupBy({
    by: ["material"],
    _count: true,
  });
  const materialBreakdown = materialRows.reduce<Record<string, number>>(
    (acc, r) => {
      const k = r.material ?? "Unspecified";
      acc[k] = (acc[k] ?? 0) + r._count;
      return acc;
    },
    {}
  );

  // Technician workload (assigned job counts by technician)
  const workloadRows = await db.jobOrder.groupBy({
    by: ["assignedToId"],
    _count: true,
  });
  const techIds = workloadRows
    .map((r) => r.assignedToId)
    .filter((x): x is string => !!x);
  const techs =
    techIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: techIds } },
          select: { id: true, fullName: true },
        })
      : [];
  const techMap = new Map(techs.map((t) => [t.id, t.fullName]));
  const technicianWorkload = workloadRows
    .filter((r) => r.assignedToId)
    .map((r) => ({
      name: techMap.get(r.assignedToId!) ?? "Unknown",
      count: r._count,
    }))
    .sort((a, b) => b.count - a.count);

  // Real period-over-period trends: compare this range vs previous range
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - rangeDays);
  rangeStart.setHours(0, 0, 0, 0);
  const prevRangeStart = new Date(rangeStart);
  prevRangeStart.setDate(prevRangeStart.getDate() - rangeDays);

  const [thisPeriodJobs, prevPeriodJobs, thisPeriodMeasurements, prevPeriodMeasurements, thisPeriodCuttingLists, prevPeriodCuttingLists] =
    await Promise.all([
      db.jobOrder.count({ where: { createdAt: { gte: rangeStart } } }),
      db.jobOrder.count({ where: { createdAt: { gte: prevRangeStart, lt: rangeStart } } }),
      db.siteMeasurement.count({ where: { createdAt: { gte: rangeStart } } }),
      db.siteMeasurement.count({ where: { createdAt: { gte: prevRangeStart, lt: rangeStart } } }),
      db.cuttingList.count({ where: { createdAt: { gte: rangeStart } } }),
      db.cuttingList.count({ where: { createdAt: { gte: prevRangeStart, lt: rangeStart } } }),
    ]);

  function pctChange(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  return NextResponse.json({
    counts: {
      users,
      activeUsers,
      jobOrders,
      pendingJobs,
      measurements,
      cuttingLists,
      customers,
      overdueJobs,
    },
    trends: {
      jobOrders: pctChange(thisPeriodJobs, prevPeriodJobs),
      measurements: pctChange(thisPeriodMeasurements, prevPeriodMeasurements),
      cuttingLists: pctChange(thisPeriodCuttingLists, prevPeriodCuttingLists),
      users: null, // users don't have a meaningful period trend
    },
    jobStatusBreakdown: statusBreakdown,
    priorityBreakdown,
    throughput,
    materialBreakdown,
    technicianWorkload,
    role: session.role,
  });
}
