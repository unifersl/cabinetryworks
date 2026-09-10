import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.attendanceRecord.findUnique({
    where: { id },
    include: {
      worker: { select: { id: true, name: true } },
      job: { select: { id: true, orderNumber: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  await db.attendanceRecord.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Attendance record deleted for ${existing.worker?.name ?? "worker"}${existing.job?.orderNumber ? ` on job ${existing.job.orderNumber}` : ""} by ${session.fullName}`,
    details: {
      workerId: existing.workerId,
      workerName: existing.worker?.name ?? null,
      date: existing.date,
      status: existing.status,
      hoursWorked: Number(existing.hoursWorked),
    },
  });

  return NextResponse.json({ ok: true });
});
