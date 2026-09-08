import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const workers = await db.worker.findMany({
    where,
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({
    workers: workers.map((w) => ({ ...w, hourlyRate: Number(w.hourlyRate) })),
  });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const worker = await db.worker.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      code: body?.code ? String(body.code) : null,
      name,
      phone: body?.phone ? String(body.phone) : null,
      role: body?.role ? String(body.role) : null,
      type: body?.type ? String(body.type) : "factory",
      status: body?.status ? String(body.status) : "active",
      hourlyRate: body?.hourlyRate !== undefined ? Number(body.hourlyRate) || 0 : 0,
    },
  });

  return NextResponse.json({ worker: { ...worker, hourlyRate: Number(worker.hourlyRate) } }, { status: 201 });
});
