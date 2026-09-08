import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import type { JobStatus } from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/job-orders/bulk
 * Perform bulk operations on multiple jobs at once.
 * Body: { ids: string[], action: "archive"|"restore"|"status"|"assign", value?: string }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];
  const action = String(body?.action ?? "");
  const value = body?.value;

  if (ids.length === 0) {
    return NextResponse.json({ error: "No job IDs provided" }, { status: 400 });
  }
  if (!["archive", "restore", "status", "assign"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Build the update data based on action
  let updateData: Record<string, unknown> = {};
  let auditSummary = "";

  switch (action) {
    case "archive":
      updateData.archived = true;
      auditSummary = `Bulk archived ${ids.length} job(s)`;
      break;
    case "restore":
      updateData.archived = false;
      auditSummary = `Bulk restored ${ids.length} job(s)`;
      break;
    case "status":
      if (!value) {
        return NextResponse.json({ error: "Status value required" }, { status: 400 });
      }
      updateData.status = String(value);
      auditSummary = `Bulk status change → ${value} (${ids.length} jobs)`;
      break;
    case "assign":
      updateData.assignedToId = value || null;
      auditSummary = `Bulk assign (${ids.length} jobs)`;
      break;
  }

  // Fetch job numbers for audit detail
  const jobs = await db.jobOrder.findMany({
    where: { id: { in: ids } },
    select: { orderNumber: true },
  });
  const orderNumbers = jobs.map((j) => j.orderNumber);

  // Perform bulk update
  const result = await db.jobOrder.updateMany({
    where: { id: { in: ids } },
    data: updateData,
  });

  await recordAudit({
    action: "update",
    entityType: "job",
    actor: session,
    summary: auditSummary,
    details: { ids, orderNumbers, action, value: value ?? null, count: result.count },
  });

  return NextResponse.json({
    updated: result.count,
    action,
    value: value ?? null,
  });
}
