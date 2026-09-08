import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { jobOrders: true } },
      jobOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

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
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null;
  if (body.address !== undefined) data.address = body.address ? String(body.address) : null;
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;

  try {
    const updated = await db.customer.update({
      where: { id },
      data,
      include: { _count: { select: { jobOrders: true } } },
    });
    return NextResponse.json({ customer: updated });
  } catch (err) {
    console.error("[customers/PUT]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
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
  const customer = await db.customer.findUnique({
    where: { id },
    include: { _count: { select: { jobOrders: true } } },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (customer._count.jobOrders > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: customer has ${customer._count.jobOrders} job order(s). Reassign or complete those first.`,
      },
      { status: 400 }
    );
  }
  await recordAudit({
    action: "delete",
    entityType: "customer",
    entityId: id,
    actor: session,
    summary: `Deleted customer: ${customer.name}`,
    details: { name: customer.name, email: customer.email },
  });
  await db.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
