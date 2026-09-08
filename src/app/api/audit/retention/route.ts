import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * POST /api/audit/retention
 * Delete audit log entries older than N days.
 * Body: { days: number } (default 90)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const days = Math.max(Number(body?.days ?? 90), 1);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    actor: session,
    summary: `Audit retention cleanup: deleted ${result.count} entries older than ${days} days`,
    details: { days, deletedCount: result.count, cutoff: cutoff.toISOString() },
  });

  return NextResponse.json({
    deleted: result.count,
    days,
    cutoff: cutoff.toISOString(),
  });
}
