import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

function num(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await db.jobOrder.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      deliveryDate: true,
    },
  });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Time logs
  const timeLogs = await db.jobTimeLog.findMany({
    where: { jobId: id },
    orderBy: { workDate: "desc" },
    include: { user: { select: { id: true, fullName: true, role: true } } },
  });

  const hoursByWorker = new Map<string, { workerName: string; hours: number; logCount: number }>();
  const hoursByWorkType = new Map<string, number>();
  let totalHours = 0;
  let totalLaborCost = 0;
  for (const log of timeLogs) {
    const h = num(log.hoursWorked);
    totalHours += h;
    totalLaborCost += num(log.laborCost);
    const key = log.workerName;
    const existing = hoursByWorker.get(key) ?? { workerName: log.workerName, hours: 0, logCount: 0 };
    existing.hours += h;
    existing.logCount += 1;
    hoursByWorker.set(key, existing);
    hoursByWorkType.set(log.workType, (hoursByWorkType.get(log.workType) ?? 0) + h);
  }

  // Transports
  const transports = await db.jobTransport.findMany({
    where: { jobId: id },
    orderBy: { date: "desc" },
  });
  const totalDistance = transports.reduce((s, t) => s + num(t.distanceKm), 0);
  const totalTransportCost = transports.reduce((s, t) => s + num(t.cost), 0);

  // F&B
  const fbItems = await db.jobFoodBeverage.findMany({
    where: { jobId: id },
    orderBy: { date: "desc" },
  });
  const totalMeals = fbItems.reduce((s, f) => s + (f.personCount || 0), 0);
  const totalFnBCost = fbItems.reduce((s, f) => s + num(f.cost), 0);
  const mealsByType = new Map<string, number>();
  for (const f of fbItems) {
    mealsByType.set(f.mealType, (mealsByType.get(f.mealType) ?? 0) + (f.personCount || 0));
  }

  // Tool issues / returns
  const toolIssues = await db.jobToolIssue.findMany({
    where: { jobId: id },
    include: { lines: { include: { tool: { select: { id: true, name: true, code: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const toolReturns = await db.jobToolReturn.findMany({
    where: { jobId: id },
    include: { lines: { include: { tool: { select: { id: true, name: true, code: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const toolUtilization = new Map<string, { toolId: string; toolName: string; toolCode: string | null; issued: number; returned: number; lost: number; damaged: number }>();
  for (const issue of toolIssues) {
    for (const line of issue.lines) {
      const key = line.toolId;
      const existing = toolUtilization.get(key) ?? { toolId: line.toolId, toolName: line.tool.name, toolCode: line.tool.code, issued: 0, returned: 0, lost: 0, damaged: 0 };
      existing.issued += line.quantity;
      toolUtilization.set(key, existing);
    }
  }
  for (const ret of toolReturns) {
    for (const line of ret.lines) {
      const key = line.toolId;
      const existing = toolUtilization.get(key) ?? { toolId: line.toolId, toolName: line.tool.name, toolCode: line.tool.code, issued: 0, returned: 0, lost: 0, damaged: 0 };
      existing.returned += line.quantity;
      if (line.condition === "lost") existing.lost += line.quantity;
      if (line.condition === "damaged") existing.damaged += line.quantity;
      toolUtilization.set(key, existing);
    }
  }

  // Inventory movements linked to this job
  const stockRequests = await db.stockRequest.findMany({
    where: { jobId: id },
    include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } }, warehouse: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const goodsIssues = await db.goodsIssue.findMany({
    where: { jobId: id },
    include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } }, warehouse: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const goodsReturns = await db.goodsReturn.findMany({
    where: { jobId: id },
    include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } }, warehouse: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const outsidePurchases = await db.outsidePurchase.findMany({
    where: { jobId: id },
    include: { lines: { include: { item: { select: { id: true, name: true, unit: true } } } }, warehouse: { select: { code: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  let issuedQty = 0;
  for (const gi of goodsIssues) for (const l of gi.lines) issuedQty += num(l.quantity);
  let returnedQty = 0;
  for (const gr of goodsReturns) for (const l of gr.lines) returnedQty += num(l.quantity);
  let purchasedQty = 0;
  for (const op of outsidePurchases) for (const l of op.lines) purchasedQty += num(l.quantity);

  // Expenses
  const expenses = await db.jobExpense.findMany({
    where: { jobId: id },
    orderBy: { date: "desc" },
  });
  let expenseTotal = 0;
  const expenseByCat = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const amt = num(e.amount);
    expenseTotal += amt;
    const existing = expenseByCat.get(e.category) ?? { total: 0, count: 0 };
    existing.total += amt;
    existing.count += 1;
    expenseByCat.set(e.category, existing);
  }

  // Attendance linked to this job
  const attendanceRecords = await db.attendanceRecord.findMany({
    where: { jobId: id },
    include: { worker: { select: { id: true, name: true, code: true, role: true } } },
    orderBy: { date: "desc" },
  });
  let attendanceHours = 0;
  const attendanceByWorker = new Map<string, { workerName: string; hours: number; days: number }>();
  for (const a of attendanceRecords) {
    attendanceHours += num(a.hoursWorked);
    const key = a.worker?.name ?? "Unknown";
    const existing = attendanceByWorker.get(key) ?? { workerName: key, hours: 0, days: 0 };
    existing.hours += num(a.hoursWorked);
    existing.days += 1;
    attendanceByWorker.set(key, existing);
  }

  // Status timeline (audit logs for this job)
  const auditLogs = await db.auditLog.findMany({
    where: { entityType: "job", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, action: true, summary: true, actorName: true, createdAt: true },
  });

  // Job progress (rough heuristic based on status)
  const PIPELINE = ["Pending", "Measured", "Design", "In Production", "Cutting", "Assembly", "Installation", "Completed"];
  const idx = PIPELINE.indexOf(job.status);
  const progressPct = job.status === "Cancelled" ? 0 : idx >= 0 ? Math.round(((idx + 1) / PIPELINE.length) * 100) : 0;

  return NextResponse.json({
    job: {
      id: job.id,
      orderNumber: job.orderNumber,
      title: job.title,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      deliveryDate: job.deliveryDate,
    },
    timeLogs: {
      total: timeLogs.length,
      totalHours: Math.round(totalHours * 100) / 100,
      totalLaborCost: Math.round(totalLaborCost * 100) / 100,
      hoursByWorker: Array.from(hoursByWorker.values()).sort((a, b) => b.hours - a.hours),
      hoursByWorkType: Array.from(hoursByWorkType.entries()).map(([workType, hours]) => ({ workType, hours: Math.round(hours * 100) / 100 })),
    },
    transports: {
      total: transports.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalCost: Math.round(totalTransportCost * 100) / 100,
      byPurpose: transports.reduce((acc, t) => {
        acc[t.purpose] = (acc[t.purpose] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    },
    foodBeverage: {
      total: fbItems.length,
      totalMeals,
      totalCost: Math.round(totalFnBCost * 100) / 100,
      mealsByType: Array.from(mealsByType.entries()).map(([mealType, count]) => ({ mealType, count })),
    },
    tools: {
      issuesCount: toolIssues.length,
      returnsCount: toolReturns.length,
      totalIssuedQty: Array.from(toolUtilization.values()).reduce((s, t) => s + t.issued, 0),
      totalReturnedQty: Array.from(toolUtilization.values()).reduce((s, t) => s + t.returned, 0),
      totalLostQty: Array.from(toolUtilization.values()).reduce((s, t) => s + t.lost, 0),
      totalDamagedQty: Array.from(toolUtilization.values()).reduce((s, t) => s + t.damaged, 0),
      utilization: Array.from(toolUtilization.values()),
    },
    stock: {
      requestsCount: stockRequests.length,
      issuesCount: goodsIssues.length,
      returnsCount: goodsReturns.length,
      outsidePurchasesCount: outsidePurchases.length,
      totalIssuedQty: Math.round(issuedQty * 100) / 100,
      totalReturnedQty: Math.round(returnedQty * 100) / 100,
      totalPurchasedQty: Math.round(purchasedQty * 100) / 100,
    },
    expenses: {
      total: Math.round(expenseTotal * 100) / 100,
      count: expenses.length,
      byCategory: Array.from(expenseByCat.entries())
        .map(([category, v]) => ({ category, total: Math.round(v.total * 100) / 100, count: v.count }))
        .sort((a, b) => b.total - a.total),
    },
    attendance: {
      total: attendanceRecords.length,
      totalHours: Math.round(attendanceHours * 100) / 100,
      byWorker: Array.from(attendanceByWorker.values())
        .map((w) => ({ workerName: w.workerName, hours: Math.round(w.hours * 100) / 100, days: w.days }))
        .sort((a, b) => b.hours - a.hours),
    },
    costSummary: {
      labor: Math.round(totalLaborCost * 100) / 100,
      transport: Math.round(totalTransportCost * 100) / 100,
      foodBeverage: Math.round(totalFnBCost * 100) / 100,
      expenses: Math.round(expenseTotal * 100) / 100,
      grandTotal: Math.round((totalLaborCost + totalTransportCost + totalFnBCost + expenseTotal) * 100) / 100,
    },
    timeline: auditLogs,
    progress: {
      percent: progressPct,
      pipeline: PIPELINE,
      currentIndex: idx,
    },
  });
});
