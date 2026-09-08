import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.subcontractor.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name && name !== existing.name) {
      const clash = await db.subcontractor.findUnique({ where: { name } });
      if (clash) return NextResponse.json({ error: "Subcontractor with this name already exists" }, { status: 409 });
    }
    data.name = name;
  }
  if (body.trade !== undefined) data.trade = String(body.trade);
  if (body.contactName !== undefined) data.contactName = body.contactName ? String(body.contactName) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null;
  if (body.rating !== undefined) data.rating = Math.max(1, Math.min(5, Math.floor(Number(body.rating)) || 3));
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  const subcontractor = await db.subcontractor.update({
    where: { id },
    data,
    include: {
      _count: { select: { assignments: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "subcontractor",
    entityId: id,
    actor: session,
    summary: `Updated subcontractor "${subcontractor.name}"`,
    details: { subcontractorId: id, changes: Object.keys(data) },
  });

  return NextResponse.json({ subcontractor });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.subcontractor.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade-deletes assignments per schema (onDelete: Cascade)
  await db.subcontractor.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "subcontractor",
    entityId: id,
    actor: session,
    summary: `Deleted subcontractor "${existing.name}" (${existing.trade})`,
    details: { subcontractorId: id, name: existing.name, trade: existing.trade },
  });

  return NextResponse.json({ ok: true });
});
