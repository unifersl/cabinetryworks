import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/audit?action=&entityType=&entityId=&page=&pageSize=&from=&to=&limit=
 *
 * Returns audit log entries. Admin/SuperAdmin/Manager + Auditor only.
 *
 * Pagination: `page` (1-based, default 1) + `pageSize` (default 50, max 100).
 * Date filter: `from` / `to` (ISO date strings, inclusive on both ends —
 *   `to` is rolled forward to end-of-day so the entire "to" date is included).
 *
 * Backward-compat: callers passing only `limit` (no `page`) get the legacy
 * behaviour — first N rows. When `page` is provided, response includes
 * `{ logs, total, page, pageSize, stats }`.
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
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Pagination — `page` is 1-based. If the caller supplies `page` we use
  // proper offset pagination; otherwise we fall back to the legacy
  // `limit`-only behaviour for backward compatibility with the existing
  // activity-feed / overview widgets.
  const pageRaw = Number(searchParams.get("page") ?? "");
  const hasPage = Number.isFinite(pageRaw) && pageRaw > 0;
  const page = hasPage ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "");
  const hasPageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0;
  const pageSize = hasPageSize
    ? Math.min(Math.floor(pageSizeRaw), 100) // hard cap at 100
    : 50;

  const legacyLimit = Math.min(
    Number(searchParams.get("limit") ?? "30") || 30,
    100
  );

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      // Roll "to" forward to end-of-day so the entire "to" date is included.
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        range.lte = d;
      }
    }
    if (Object.keys(range).length > 0) where.createdAt = range;
  }

  // NOTE: Auditors MUST be able to see ALL audit entries including SuperAdmin
  // actions — that is the entire purpose of a compliance auditor role.
  // The previous filter (hiding SuperAdmin entries from Auditors) defeated
  // compliance checks and has been removed.

  const take = hasPage ? pageSize : legacyLimit;
  const skip = hasPage ? (page - 1) * pageSize : 0;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        actor: {
          select: { id: true, fullName: true, role: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  // Today's count for the summary cards (independent of the active filter).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = await db.auditLog.count({
    where: { createdAt: { gte: today } },
  });

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    stats: { total, todayCount },
  });
}
