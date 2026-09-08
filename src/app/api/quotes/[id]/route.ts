import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = String(body.status);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.validUntil !== undefined)
    data.validUntil = body.validUntil ? new Date(body.validUntil) : null;

  const quote = await db.savedQuote.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true } },
      customer: { select: { id: true, name: true } },
    },
  });

  if (body.status !== undefined) {
    await recordAudit({
      action: "status_change",
      entityType: "settings",
      entityId: id,
      actor: session,
      summary: `Quote ${quote.quoteNumber} → ${body.status}`,
      details: { quoteNumber: quote.quoteNumber, newStatus: body.status },
    });
  }

  return NextResponse.json({ quote });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const quote = await db.savedQuote.findUnique({ where: { id } });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: id,
    actor: session,
    summary: `Deleted quote ${quote.quoteNumber}`,
  });
  await db.savedQuote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
