import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.worker.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.code !== undefined) data.code = body.code ? String(body.code) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.role !== undefined) data.role = body.role ? String(body.role) : null;
  if (body.type !== undefined) data.type = String(body.type);
  if (body.status !== undefined) data.status = String(body.status);
  if (body.hourlyRate !== undefined) data.hourlyRate = Number(body.hourlyRate) || 0;

  const worker = await db.worker.update({ where: { id }, data });
  return NextResponse.json({ worker: { ...worker, hourlyRate: Number(worker.hourlyRate) } });
});

export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.worker.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  await db.worker.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
