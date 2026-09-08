import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function generateReturnNo(): Promise<string> {
  const count = await db.jobToolReturn.count();
  const year = new Date().getFullYear();
  return `TR-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const returns = await db.jobToolReturn.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      lines: { include: { tool: true } },
    },
  });

  return NextResponse.json({
    returns: returns.map((r) => ({ ...r, lineCount: r.lines.length })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  const linesRaw = Array.isArray(body?.lines) ? body.lines : [];
  const issueId = body?.issueId ? String(body.issueId) : null;

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }
  if (linesRaw.length === 0) {
    return NextResponse.json({ error: "Add at least one tool" }, { status: 400 });
  }

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (issueId) {
    const issue = await db.jobToolIssue.findUnique({ where: { id: issueId } });
    if (!issue) return NextResponse.json({ error: "Linked issue not found" }, { status: 404 });
  }

  // Validate tools exist
  for (const line of linesRaw) {
    const tool = await db.jobTool.findUnique({ where: { id: String(line.toolId) } });
    if (!tool) return NextResponse.json({ error: `Tool not found: ${line.toolId}` }, { status: 404 });
  }

  const returnNo = await generateReturnNo();

  const ret = await db.$transaction(async (tx) => {
    const created = await tx.jobToolReturn.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        returnNo,
        jobId,
        issueId,
        returnedBy: session.id,
        returnedFrom: body?.returnedFrom ? String(body.returnedFrom) : null,
        date: body?.date ? new Date(body.date) : new Date(),
        status: "returned",
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

    // Update each tool's status based on the return condition
    // If all return lines for a tool are "good" or "fair", mark as available
    // If any return line is "lost", mark as lost
    // If any return line is "damaged", mark as damaged
    for (const line of created.lines) {
      const condition = line.condition;
      let newStatus = "available";
      if (condition === "lost") newStatus = "lost";
      else if (condition === "damaged") newStatus = "damaged";
      await tx.jobTool.update({
        where: { id: line.toolId },
        data: { status: newStatus },
      });
    }

    // If linked to an issue, update issue status
    if (issueId) {
      const issueLines = await tx.jobToolIssueLine.findMany({
        where: { issueId },
      });
      // Simple heuristic: if all tools in the issue are now available/damaged/lost (not "issued"),
      // mark the issue as "returned". Otherwise "partial".
      const toolIds = issueLines.map((l) => l.toolId);
      if (toolIds.length > 0) {
        const tools = await tx.jobTool.findMany({
          where: { id: { in: toolIds } },
          select: { status: true },
        });
        const anyIssued = tools.some((t) => t.status === "issued");
        await tx.jobToolIssue.update({
          where: { id: issueId },
          data: { status: anyIssued ? "partial" : "returned" },
        });
      }
    }

    return created;
  });

  await recordAudit({
    action: "create",
    entityType: "job",
    entityId: jobId,
    actor: session,
    summary: `Tool return ${returnNo}: ${ret.lines.length} tool(s) on ${job.orderNumber}`,
    details: { returnId: ret.id, jobId, returnNo, issueId, lineCount: ret.lines.length },
  });

  return NextResponse.json(
    { return: { ...ret, lineCount: ret.lines.length } },
    { status: 201 }
  );
});
