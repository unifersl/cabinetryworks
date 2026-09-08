import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

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

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.jobTimeLog.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.workerName !== undefined) data.workerName = String(body.workerName);
  if (body.workType !== undefined) data.workType = String(body.workType);
  if (body.userId !== undefined) data.userId = body.userId ? String(body.userId) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.workDate !== undefined) data.workDate = new Date(body.workDate);

  // Handle clock in/out and recompute hours
  const newClockIn = body.clockIn !== undefined
    ? (body.clockIn ? new Date(body.clockIn) : null)
    : existing.clockIn;
  const newClockOut = body.clockOut !== undefined
    ? (body.clockOut ? new Date(body.clockOut) : null)
    : existing.clockOut;

  if (body.clockIn !== undefined) data.clockIn = newClockIn;
  if (body.clockOut !== undefined) data.clockOut = newClockOut;

  if (body.hoursWorked !== undefined) {
    const explicit = Number(body.hoursWorked);
    if (Number.isFinite(explicit) && explicit > 0) {
      data.hoursWorked = explicit;
    } else if (newClockIn && newClockOut) {
      data.hoursWorked = computeHours(
        body.clockIn ?? existing.clockIn?.toISOString(),
        body.clockOut ?? existing.clockOut?.toISOString()
      );
    } else {
      data.hoursWorked = 0;
    }
  } else if (body.clockIn !== undefined || body.clockOut !== undefined) {
    if (newClockIn && newClockOut) {
      data.hoursWorked = computeHours(
        newClockIn.toISOString(),
        newClockOut.toISOString()
      );
    } else {
      data.hoursWorked = 0;
    }
  }

  // Handle hourlyRate and recompute laborCost
  if (body.hourlyRate !== undefined) {
    data.hourlyRate = Number(body.hourlyRate) || 0;
  }
  const effectiveRate = body.hourlyRate !== undefined ? (Number(body.hourlyRate) || 0) : Number(existing.hourlyRate);
  const effectiveHours = data.hoursWorked !== undefined ? Number(data.hoursWorked) : Number(existing.hoursWorked);
  data.laborCost = Math.round(effectiveHours * effectiveRate * 100) / 100;

  const log = await db.jobTimeLog.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, fullName: true, role: true } },
    },
  });

  return NextResponse.json({ log: { ...log, hoursWorked: Number(log.hoursWorked), hourlyRate: Number(log.hourlyRate), laborCost: Number(log.laborCost) } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobTimeLog.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobTimeLog.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
