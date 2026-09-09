import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Try to count users
    const userCount = await db.user.count();
    return NextResponse.json({
      status: "ok",
      database: "connected",
      users: userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      status: "error",
      database: "failed",
      error: message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
