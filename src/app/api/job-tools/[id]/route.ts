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

  const existing = await db.jobTool.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    if (name !== existing.name) {
      const dup = await db.jobTool.findUnique({ where: { name } });
      if (dup) return NextResponse.json({ error: "Name already in use" }, { status: 409 });
    }
    data.name = name;
  }
  if (body.code !== undefined) {
    const code = body.code ? String(body.code).trim() : null;
    if (code && code !== existing.code) {
      const dup = await db.jobTool.findUnique({ where: { code } });
      if (dup) return NextResponse.json({ error: "Code already in use" }, { status: 409 });
    }
    data.code = code;
  }
  if (body.category !== undefined) data.category = String(body.category);
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
  if (body.status !== undefined) data.status = String(body.status);

  const tool = await db.jobTool.update({
    where: { id },
    data,
    include: { _count: { select: { issueLines: true, returnLines: true } } },
  });

  await recordAudit({
    action: "update",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Updated tool: ${tool.name}`,
    details: { toolId: id, changes: Object.keys(data) },
  });

  return NextResponse.json({ tool });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobTool.findUnique({
    where: { id },
    include: {
      _count: { select: { issueLines: true, returnLines: true } },
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check no active issues (any issue line where the parent issue is not in returned/lost status)
  const activeLines = await db.jobToolIssueLine.findMany({
    where: { toolId: id, issue: { status: { in: ["issued", "partial"] } } },
    take: 1,
  });
  if (activeLines.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete a tool that has active (issued) issues. Return or mark lost first." },
      { status: 400 }
    );
  }

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted tool: ${existing.name}`,
    details: { toolId: id, name: existing.name },
  });

  await db.jobTool.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
