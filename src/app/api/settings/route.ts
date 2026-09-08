import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.systemSetting.findMany();
  const settings = rows.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.value ?? "";
    return acc;
  }, {});
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, string>;
  const keys = Object.keys(body);
  for (const key of keys) {
    await db.systemSetting.upsert({
      where: { key },
      update: { value: body[key] ?? "" },
      create: { id: key, key, value: body[key] ?? "" },
    });
  }
  return NextResponse.json({ ok: true });
}
