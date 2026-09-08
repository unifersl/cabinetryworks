import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateIssueNo(): Promise<string> {
  const count = await db.jobToolIssue.count();
  const year = new Date().getFullYear();
  return `TI-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const issues = await db.jobToolIssue.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      lines: { include: { tool: true } },
    },
  });

  return NextResponse.json({
    issues: issues.map((i) => ({ ...i, lineCount: i.lines.length })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one tool" }, { status: 400 });
  }

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Validate tools exist
  for (const line of linesRaw) {
    const tool = await db.jobTool.findUnique({ where: { id: String(line.toolId) } });
    if (!tool) return NextResponse.json({ error: `Tool not found: ${line.toolId}` }, { status: 404 });
  }

  const issueNo = await generateIssueNo();

  const issue = await db.$transaction(async (tx) => {
    const created = await tx.jobToolIssue.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        issueNo,
        jobId,
        issuedBy: session.id,
        issuedTo: body?.issuedTo ? String(body.issuedTo) : null,
        date: body?.date ? new Date(body.date) : new Date(),
        status: "issued",
        notes: body?.notes ? String(body.notes) : null,
        lines: {
          create: linesRaw.map((line: Record<string, unknown>) => ({
            id: randomUUID(),
            toolId: String(line.toolId),
            quantity: Math.max(1, parseInt(String(line.quantity), 10) || 1),
            condition: line.condition ? String(line.condition) : "good",
          })),
        },
      },
      include: {
        job: { select: { id: true, orderNumber: true, title: true } },
        lines: { include: { tool: true } },
      },
    });

    // Update each tool's status to "issued"
    for (const line of created.lines) {
      await tx.jobTool.update({
        where: { id: line.toolId },
        data: { status: "issued" },
      });
    }

    return created;
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Tool issue ${issueNo}: ${issue.lines.length} tool(s) on ${job.orderNumber}`,
    details: { issueId: issue.id, jobId, issueNo, lineCount: issue.lines.length },
  });

  return NextResponse.json(
    { issue: { ...issue, lineCount: issue.lines.length } },
    { status: 201 }
  );
});
