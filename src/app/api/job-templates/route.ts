import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const active = searchParams.get("active");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (active !== null && active !== undefined) {
    if (active === "true") where.isActive = true;
    else if (active === "false") where.isActive = false;
  }

  const templates = await db.jobTemplate.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({
    templates: templates.map((t) => ({
      ...t,
      estimatedHours: Number(t.estimatedHours),
    })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Unique check
  const existing = await db.jobTemplate.findUnique({ where: { name } });
  if (existing) return NextResponse.json({ error: "A template with this name already exists" }, { status: 409 });

  const template = await db.jobTemplate.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      description: body?.description ? String(body.description) : null,
      category: body?.category ? String(body.category) : null,
      defaultCuttingList: body?.defaultCuttingList ? (typeof body.defaultCuttingList === "string" ? String(body.defaultCuttingList) : JSON.stringify(body.defaultCuttingList)) : null,
      defaultHardware: body?.defaultHardware ? (typeof body.defaultHardware === "string" ? String(body.defaultHardware) : JSON.stringify(body.defaultHardware)) : null,
      defaultBoM: body?.defaultBoM ? (typeof body.defaultBoM === "string" ? String(body.defaultBoM) : JSON.stringify(body.defaultBoM)) : null,
      estimatedHours: body?.estimatedHours !== undefined ? Number(body.estimatedHours) || 0 : 0,
      estimatedDays: body?.estimatedDays !== undefined ? Number(body.estimatedDays) || 0 : 0,
      isActive: body?.isActive !== undefined ? Boolean(body.isActive) : true,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: template.id,
    actor: session,
    summary: `Created job template "${name}"`,
    details: { templateId: template.id, name, category: template.category },
  });

  return NextResponse.json({ template: { ...template, estimatedHours: Number(template.estimatedHours) } }, { status: 201 });
});
