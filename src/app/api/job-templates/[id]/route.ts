import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.jobTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If renaming, ensure unique
  if (body.name !== undefined && String(body.name).trim() !== existing.name) {
    const conflict = await db.jobTemplate.findUnique({ where: { name: String(body.name).trim() } });
    if (conflict) return NextResponse.json({ error: "A template with this name already exists" }, { status: 409 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.category !== undefined) data.category = body.category ? String(body.category) : null;
  if (body.defaultCuttingList !== undefined) data.defaultCuttingList = typeof body.defaultCuttingList === "string" ? String(body.defaultCuttingList) : JSON.stringify(body.defaultCuttingList);
  if (body.defaultHardware !== undefined) data.defaultHardware = typeof body.defaultHardware === "string" ? String(body.defaultHardware) : JSON.stringify(body.defaultHardware);
  if (body.defaultBoM !== undefined) data.defaultBoM = typeof body.defaultBoM === "string" ? String(body.defaultBoM) : JSON.stringify(body.defaultBoM);
  if (body.estimatedHours !== undefined) data.estimatedHours = Number(body.estimatedHours) || 0;
  if (body.estimatedDays !== undefined) data.estimatedDays = Number(body.estimatedDays) || 0;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

  const template = await db.jobTemplate.update({ where: { id }, data });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated job template "${template.name}"`,
    details: { templateId: id, changes: Object.keys(data) },
  });

  return NextResponse.json({ template: { ...template, estimatedHours: Number(template.estimatedHours) } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.jobTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobTemplate.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted job template "${existing.name}"`,
    details: { templateId: id, name: existing.name },
  });

  return NextResponse.json({ ok: true });
});
