import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const url = "postgresql://postgres.bxcelvhzzfqkcmmekaek:%2AnDwopXdNXu3Ykcw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
  
  // Test 1: DNS resolution
  let dnsResult = "unknown";
  try {
    const { hostname } = new URL(url);
    dnsResult = hostname;
  } catch (e) {
    dnsResult = "parse error: " + String(e);
  }

  // Test 2: Prisma connection
  try {
    const client = new PrismaClient({ datasourceUrl: url });
    const count = await client.user.count();
    await client.$disconnect();
    return NextResponse.json({
      status: "ok",
      dns: dnsResult,
      userCount: count,
      message: "Database connection works!"
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      status: "error",
      dns: dnsResult,
      error: msg.substring(0, 200),
    }, { status: 500 });
  }
}
