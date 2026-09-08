import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.inventoryCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      ...c,
      itemCount: c._count.items,
      _count: undefined,
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
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await db.inventoryCategory.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
  }

  const category = await db.inventoryCategory.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      description: body?.description ? String(body.description) : null,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: category.id,
    actor: session,
    summary: `Created inventory category: ${category.name}`,
  });

  return NextResponse.json({ category }, { status: 201 });
});
