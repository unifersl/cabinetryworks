import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.attendanceRecord.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  await db.attendanceRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
