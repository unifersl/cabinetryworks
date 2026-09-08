import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const tools = await db.jobTool.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: { select: { issueLines: true, returnLines: true } },
    },
  });

  return NextResponse.json({ tools });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
  }

  // Check name uniqueness
  const existing = await db.jobTool.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "A tool with this name already exists" }, { status: 409 });
  }

  const code = body?.code ? String(body.code).trim() : null;
  if (code) {
    const existingCode = await db.jobTool.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json({ error: "A tool with this code already exists" }, { status: 409 });
    }
  }

  const tool = await db.jobTool.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      code,
      category: body?.category ? String(body.category) : "hand_tool",
      description: body?.description ? String(body.description) : null,
      status: body?.status ? String(body.status) : "available",
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: tool.id,
    actor: session,
    summary: `Created tool: ${tool.name}`,
    details: { toolId: tool.id, name, category: tool.category, code: tool.code },
  });

  return NextResponse.json({ tool }, { status: 201 });
});
