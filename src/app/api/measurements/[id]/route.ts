import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const m = await db.siteMeasurement.findUnique({ where: { id } });
  if (!m) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageUsers(session.role) && m.takenById !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await recordAudit({
    action: "delete",
    entityType: "measurement",
    entityId: id,
    actor: session,
    summary: `Deleted measurement: ${m.roomType ?? "Measurement"}`,
    details: { jobId: m.jobId, roomType: m.roomType },
  });
  await db.siteMeasurement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
