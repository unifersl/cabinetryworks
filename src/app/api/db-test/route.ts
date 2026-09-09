import { NextResponse } from "next/server";
import net from "net";
import dns from "dns/promises";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const host = "aws-0-ap-southeast-2.pooler.supabase.com";
  const port = 6543;
  const results: any = { host, port };

  // Test 1: DNS resolution
  try {
    const addresses = await dns.resolve4(host);
    results.dnsIPv4 = addresses;
  } catch (e) {
    results.dnsIPv4Error = e instanceof Error ? e.message : String(e);
  }

  try {
    const addresses6 = await dns.resolve6(host);
    results.dnsIPv6 = addresses6;
  } catch (e) {
    results.dnsIPv6Error = e instanceof Error ? e.message : String(e);
  }

  // Test 2: TCP connection
  results.tcp = await new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ status: "timeout", message: "Connection timed out after 5s" });
    }, 5000);

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ status: "connected", message: "TCP connection succeeded!" });
    });

    socket.on("error", (err) => {
      clearTimeout(timeout);
      resolve({ status: "error", message: err.message });
    });
  });

  // Test 3: Prisma connection with the pooler URL
  const url = "postgresql://postgres.bxcelvhzzfqkcmmekaek:%2AnDwopXdNXu3Ykcw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres";
  try {
    const client = new PrismaClient({ datasourceUrl: url });
    const count = await client.user.count();
    await client.$disconnect();
    results.prisma = { status: "ok", userCount: count };
  } catch (e) {
    results.prisma = { status: "error", message: e instanceof Error ? e.message.substring(0, 150) : String(e) };
  }

  return NextResponse.json(results);
}
