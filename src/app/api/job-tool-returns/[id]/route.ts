import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const GET = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ret = await db.jobToolReturn.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      lines: { include: { tool: true } },
    },
  });
  if (!ret) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ return: { ...ret, lineCount: ret.lines.length } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobToolReturn.findUnique({
    where: { id },
    include: { lines: true, job: { select: { orderNumber: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted tool return ${existing.returnNo} on ${existing.job?.orderNumber ?? ""}`,
    details: { returnId: id, returnNo: existing.returnNo },
  });

  await db.jobToolReturn.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
