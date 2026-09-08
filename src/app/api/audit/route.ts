import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/audit?action=&entityType=&entityId=&limit=
 * Returns audit log entries. Admin/SuperAdmin only.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role) && session.role !== "Auditor")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(Number(searchParams.get("limit") ?? "30"), 100);

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  // Auditors cannot see SuperAdmin's log entries
  if (session.role === "Auditor") {
    where.NOT = {
      actor: { role: "SuperAdmin" },
    };
  }

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: { id: true, fullName: true, role: true },
      },
    },
  });

  // Get summary stats
  const total = await db.auditLog.count({ where });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await db.auditLog.count({
    where: { createdAt: { gte: today } },
  });

  return NextResponse.json({
    logs,
    stats: { total, todayCount },
  });
}
