import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userCount = await db.user.count();
    return NextResponse.json({ status: "ok", database: "connected", users: userCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "error", database: "failed", error: msg.substring(0, 300) }, { status: 500 });
  }
}
