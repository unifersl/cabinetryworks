import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
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

  // Role check: only Admin / SuperAdmin / Manager can delete ANYONE's
  // attendance. A non-privileged user may delete only their OWN attendance
  // records (those they originally created). Without this check, any
  // authenticated user (Technician, Storekeeper, Auditor) could delete any
  // worker's attendance, breaking payroll / hours auditing.
  if (!canManageUsers(session.role) && existing.createdBy !== session.id) {
    return NextResponse.json(
      { error: "Forbidden — you can only delete your own attendance records" },
      { status: 403 }
    );
  }

  await db.attendanceRecord.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "attendance",
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
