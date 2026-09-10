import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.worker.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.code !== undefined) data.code = body.code ? String(body.code) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.role !== undefined) data.role = body.role ? String(body.role) : null;
  if (body.type !== undefined) data.type = String(body.type);
  if (body.status !== undefined) data.status = String(body.status);
  if (body.hourlyRate !== undefined) data.hourlyRate = Number(body.hourlyRate) || 0;

  const worker = await db.worker.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "user",
    entityId: worker.id,
    actor: session,
    summary: `Worker ${worker.name}${worker.code ? ` (${worker.code})` : ""} updated by ${session.fullName}`,
    details: {
      before: {
        name: existing.name,
        code: existing.code,
        role: existing.role,
        type: existing.type,
        status: existing.status,
        hourlyRate: Number(existing.hourlyRate),
      },
      after: {
        name: worker.name,
        code: worker.code,
        role: worker.role,
        type: worker.type,
        status: worker.status,
        hourlyRate: Number(worker.hourlyRate),
      },
      changedFields: Object.keys(data),
    },
  });

  return NextResponse.json({ worker: { ...worker, hourlyRate: Number(worker.hourlyRate) } });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.worker.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  await db.worker.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "user",
    entityId: id,
    actor: session,
    summary: `Worker ${existing.name}${existing.code ? ` (${existing.code})` : ""} deleted by ${session.fullName}`,
    details: {
      name: existing.name,
      code: existing.code,
      role: existing.role,
      type: existing.type,
      status: existing.status,
    },
  });

  return NextResponse.json({ ok: true });
});
