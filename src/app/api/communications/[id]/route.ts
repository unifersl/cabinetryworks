import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.communicationLog.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.communicationLog.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "communication",
    entityId: id,
    actor: session,
    summary: `Deleted communication log entry "${existing.subject}"`,
    details: { communicationId: id, jobId: existing.jobId, customerId: existing.customerId, type: existing.type },
  });

  return NextResponse.json({ ok: true });
});
