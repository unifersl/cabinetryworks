import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

// Parse "HH:MM" to minutes since midnight
function timeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

// Compute net hours: (clockOut - clockIn - break) / 60
function computeHours(clockIn?: string | null, clockOut?: string | null, breakStart?: string | null, breakEnd?: string | null): number {
  const inMin = timeToMinutes(clockIn);
  const outMin = timeToMinutes(clockOut);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;
  let gross = outMin - inMin;
  const bs = timeToMinutes(breakStart);
  const be = timeToMinutes(breakEnd);
  if (bs !== null && be !== null && be > bs) {
    gross -= (be - bs);
  }
  return Math.round((gross / 60) * 100) / 100;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("workerId");
  const jobId = searchParams.get("jobId");
  const month = searchParams.get("month"); // "YYYY-MM"
  const date = searchParams.get("date"); // "YYYY-MM-DD"

  const where: Record<string, unknown> = {};
  if (workerId) where.workerId = workerId;
  if (jobId) where.jobId = jobId;
  if (date) {
    const d = new Date(date);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    where.date = { gte: d, lt: next };
  } else if (month) {
    const [y, m] = month.split("-").map(Number);
    if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      where.date = { gte: start, lt: end };
    }
  }

  const records = await db.attendanceRecord.findMany({
    where,
    include: {
      worker: { select: { id: true, name: true, code: true, role: true, type: true, hourlyRate: true } },
      job: { select: { id: true, orderNumber: true, title: true } },
    },
    orderBy: { date: "asc" },
  });

  const serialized = records.map((r) => ({
    ...r,
    hoursWorked: Number(r.hoursWorked),
    worker: r.worker ? { ...r.worker, hourlyRate: Number(r.worker.hourlyRate) } : null,
  }));

  // Monthly summary per worker
  const summary: Record<string, { workerId: string; workerName: string; present: number; absent: number; halfDay: number; shortLeave: number; fullLeave: number; sick: number; holiday: number; totalHours: number; totalDays: number }> = {};
  for (const r of serialized) {
    const key = r.workerId;
    if (!summary[key]) {
      summary[key] = {
        workerId: key,
        workerName: r.worker?.name ?? "Unknown",
        present: 0, absent: 0, halfDay: 0, shortLeave: 0, fullLeave: 0, sick: 0, holiday: 0,
        totalHours: 0, totalDays: 0,
      };
    }
    const s = summary[key];
    s.totalDays += 1;
    s.totalHours += r.hoursWorked;
    if (r.status === "present") s.present += 1;
    else if (r.status === "absent") s.absent += 1;
    else if (r.status === "half_day") s.halfDay += 1;
    else if (r.status === "short_leave") s.shortLeave += 1;
    else if (r.status === "full_leave") s.fullLeave += 1;
    else if (r.status === "sick") s.sick += 1;
    else if (r.status === "holiday") s.holiday += 1;
  }

  return NextResponse.json({
    records: serialized,
    summary: Object.values(summary).map((s) => ({ ...s, totalHours: Math.round(s.totalHours * 100) / 100 })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workerId = String(body?.workerId ?? "").trim();
  const dateStr = String(body?.date ?? "").trim();
  if (!workerId || !dateStr) {
    return NextResponse.json({ error: "workerId and date are required" }, { status: 400 });
  }

  const worker = await db.worker.findUnique({ where: { id: workerId } });
  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const date = new Date(dateStr);
  const status = body?.status ? String(body.status) : "present";
  const clockIn = body?.clockIn ? String(body.clockIn) : null;
  const clockOut = body?.clockOut ? String(body.clockOut) : null;
  const breakStart = body?.breakStart ? String(body.breakStart) : null;
  const breakEnd = body?.breakEnd ? String(body.breakEnd) : null;

  // Auto-compute hours if times provided
  let hoursWorked = body?.hoursWorked !== undefined ? Number(body.hoursWorked) || 0 : 0;
  if (clockIn && clockOut) {
    hoursWorked = computeHours(clockIn, clockOut, breakStart, breakEnd);
  }
  // Half-day = 0.5 of standard 8h if no times
  if (status === "half_day" && hoursWorked === 0) hoursWorked = 4;

  // Allow multiple records per worker per day (different jobs/projects)
  // If an existing record matches workerId + date + jobId, update it.
  // Otherwise create a new record (worker can work on multiple jobs same day).
  const jobId = body?.jobId ? String(body.jobId) : null;

  // If an ID is provided, update that specific record
  if (body?.id) {
    const existing = await db.attendanceRecord.findUnique({ where: { id: String(body.id) } });
    if (existing) {
      const record = await db.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          status,
          clockIn,
          clockOut,
          breakStart,
          breakEnd,
          hoursWorked,
          jobId,
          workLocation: body?.workLocation ? String(body.workLocation) : null,
          notes: body?.notes ? String(body.notes) : null,
        },
        include: {
          worker: { select: { id: true, name: true, code: true, role: true, type: true, hourlyRate: true } },
          job: { select: { id: true, orderNumber: true, title: true } },
        },
      });
      return NextResponse.json({
        record: {
          ...record,
          hoursWorked: Number(record.hoursWorked),
          worker: record.worker ? { ...record.worker, hourlyRate: Number(record.worker.hourlyRate) } : null,
        },
      }, { status: 200 });
    }
  }

  // No ID provided — check if there's already a record for this worker + date + job
  // If jobId is null, check for existing record with null jobId on that date
  const existing = await db.attendanceRecord.findFirst({
    where: { workerId, date, jobId },
  });

  let record;
  if (existing) {
    // Update existing record for this worker + date + same job
    record = await db.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        status,
        clockIn,
        clockOut,
        breakStart,
        breakEnd,
        hoursWorked,
        jobId,
        workLocation: body?.workLocation ? String(body.workLocation) : null,
        notes: body?.notes ? String(body.notes) : null,
      },
      include: {
        worker: { select: { id: true, name: true, code: true, role: true, type: true, hourlyRate: true } },
        job: { select: { id: true, orderNumber: true, title: true } },
      },
    });
  } else {
    // Create new record — allows multiple per day if different jobs
    record = await db.attendanceRecord.create({
      data: {
        id: randomUUID(),
        workerId,
        date,
        status,
        clockIn,
        clockOut,
        breakStart,
        breakEnd,
        hoursWorked,
        jobId,
        workLocation: body?.workLocation ? String(body.workLocation) : null,
        notes: body?.notes ? String(body.notes) : null,
        createdBy: session.id,
      },
      include: {
        worker: { select: { id: true, name: true, code: true, role: true, type: true, hourlyRate: true } },
        job: { select: { id: true, orderNumber: true, title: true } },
      },
    });
  }

  return NextResponse.json({
    record: {
      ...record,
      hoursWorked: Number(record.hoursWorked),
      worker: record.worker ? { ...record.worker, hourlyRate: Number(record.worker.hourlyRate) } : null,
    },
  }, { status: existing ? 200 : 201 });
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Bulk update: [{ workerId, date, status, clockIn, clockOut, ... }]
  const updates = Array.isArray(body?.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const results: any[] = [];
  for (const u of updates) {
    const workerId = String(u.workerId ?? "").trim();
    const dateStr = String(u.date ?? "").trim();
    if (!workerId || !dateStr) continue;

    const date = new Date(dateStr);
    const status = u.status ? String(u.status) : "present";
    const clockIn = u.clockIn ? String(u.clockIn) : null;
    const clockOut = u.clockOut ? String(u.clockOut) : null;
    const breakStart = u.breakStart ? String(u.breakStart) : null;
    const breakEnd = u.breakEnd ? String(u.breakEnd) : null;

    let hoursWorked = u.hoursWorked !== undefined ? Number(u.hoursWorked) || 0 : 0;
    if (clockIn && clockOut) {
      hoursWorked = computeHours(clockIn, clockOut, breakStart, breakEnd);
    }
    if (status === "half_day" && hoursWorked === 0) hoursWorked = 4;

    const existing = await db.attendanceRecord.findFirst({ where: { workerId, date, jobId: u.jobId || null } });
    if (existing) {
      const updated = await db.attendanceRecord.update({
        where: { id: existing.id },
        data: { status, clockIn, clockOut, breakStart, breakEnd, hoursWorked, jobId: u.jobId || null, workLocation: u.workLocation || null, notes: u.notes || null },
      });
      results.push(updated);
    } else {
      const created = await db.attendanceRecord.create({
        data: { id: randomUUID(), workerId, date, status, clockIn, clockOut, breakStart, breakEnd, hoursWorked, jobId: u.jobId || null, workLocation: u.workLocation || null, notes: u.notes || null, createdBy: session.id },
      });
      results.push(created);
    }
  }

  return NextResponse.json({ updated: results.length, records: results });
});
