import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

function computeHours(clockIn?: string | null, clockOut?: string | null): number {
  if (!clockIn || !clockOut) return 0;
  const inMs = new Date(clockIn).getTime();
  const outMs = new Date(clockOut).getTime();
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0;
  const diffMs = outMs - inMs;
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (userId) where.userId = userId;

  const logs = await db.jobTimeLog.findMany({
    where,
    orderBy: { workDate: "desc" },
    include: {
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  return NextResponse.json({ logs: logs.map((l) => ({ ...l, hoursWorked: Number(l.hoursWorked), hourlyRate: Number(l.hourlyRate), laborCost: Number(l.laborCost) })) });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const workerName = String(body?.workerName ?? "").trim();
  const workType = body?.workType ? String(body.workType) : "onsite";

  if (!jobId || !workerName) {
    return NextResponse.json(
      { error: "jobId and workerName are required" },
      { status: 400 }
    );
  }

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true, title: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const workDate = body?.workDate ? new Date(body.workDate) : new Date();
  const clockIn = body?.clockIn ? new Date(body.clockIn) : null;
  const clockOut = body?.clockOut ? new Date(body.clockOut) : null;

  let hoursWorked = 0;
  const explicitHours = body?.hoursWorked !== undefined ? Number(body.hoursWorked) : null;
  if (explicitHours !== null && Number.isFinite(explicitHours) && explicitHours > 0) {
    hoursWorked = explicitHours;
  } else if (clockIn && clockOut) {
    hoursWorked = computeHours(body.clockIn, body.clockOut);
  }

  const hourlyRate = body?.hourlyRate !== undefined ? Number(body.hourlyRate) || 0 : 0;
  const laborCost = Math.round(hoursWorked * hourlyRate * 100) / 100;

  const log = await db.jobTimeLog.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      userId: body?.userId ? String(body.userId) : null,
      workerName,
      workDate,
      workType,
      clockIn,
      clockOut,
      hoursWorked,
      hourlyRate,
      laborCost,
      notes: body?.notes ? String(body.notes) : null,
      createdBy: session.id,
    },
    include: {
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Time log: ${workerName} ${hoursWorked}h (${workType}) on ${job.orderNumber}`,
    details: { logId: log.id, jobId, workerName, workType, hoursWorked },
  });

  return NextResponse.json({ log: { ...log, hoursWorked: Number(log.hoursWorked), hourlyRate: Number(log.hourlyRate), laborCost: Number(log.laborCost) } }, { status: 201 });
});
