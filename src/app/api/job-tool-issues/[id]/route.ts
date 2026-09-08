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
  const issue = await db.jobToolIssue.findUnique({
    where: { id },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      lines: { include: { tool: true } },
    },
  });
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ issue: { ...issue, lineCount: issue.lines.length } });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobToolIssue.findUnique({
    where: { id },
    include: { lines: true, job: { select: { orderNumber: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Revert tool statuses to "available" before deleting
  await db.$transaction(async (tx) => {
    for (const line of existing.lines) {
      // Check if any returns reference this tool+issue
      const returnsCount = await tx.jobToolReturnLine.count({
        where: { toolId: line.toolId, ret: { issueId: id } },
      });
      // If returns exist, only mark available if not returned/lost
      if (returnsCount === 0) {
        await tx.jobTool.update({
          where: { id: line.toolId },
          data: { status: "available" },
        });
      }
    }
    await tx.jobToolIssue.delete({ where: { id } });
  });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted tool issue ${existing.issueNo} on ${existing.job?.orderNumber ?? ""}`,
    details: { issueId: id, issueNo: existing.issueNo },
  });

  return NextResponse.json({ ok: true });
});
