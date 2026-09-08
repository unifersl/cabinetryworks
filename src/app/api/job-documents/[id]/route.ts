import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

/**
 * Job documents are immutable once uploaded — only DELETE is allowed.
 * To "update" a document, upload a new version (POST creates v{n+1}).
 */
export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.jobDocument.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.jobDocument.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "job",
    entityId: existing.jobId,
    actor: session,
    summary: `Deleted document "${existing.name}" (v${existing.version})`,
    details: { documentId: id, jobId: existing.jobId, name: existing.name, version: existing.version },
  });

  return NextResponse.json({ ok: true });
});
