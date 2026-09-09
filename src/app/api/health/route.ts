import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userCount = await db.user.count();
    return NextResponse.json({ status: "ok", database: "connected", users: userCount });
  } catch {
    return NextResponse.json({ status: "error", database: "failed" }, { status: 500 });
  }
}
