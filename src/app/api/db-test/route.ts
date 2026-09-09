import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 30;

const PASSWORD = "ciCJU2AnYRN6vH*7";
const PROJECT_REF = "bxcelvhzzfqkcmmekaek";

const REGIONS = [
  "us-east-1", "us-west-1", "us-west-2",
  "eu-west-1", "eu-west-2", "eu-central-1",
  "ap-southeast-1", "ap-northeast-1", "ap-south-1", "ap-east-1",
  "sa-east-1", "ca-central-1", "af-south-1",
];

export async function GET() {
  const results: Array<{ region: string; port: number; status: string; error?: string }> = [];

  for (const region of REGIONS) {
    for (const port of [6543, 5432]) {
      const url = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
      try {
        const client = new PrismaClient({ datasourceUrl: url });
        await client.user.count();
        await client.$disconnect();
        results.push({ region, port, status: "WORKS" });
        return NextResponse.json({ found: true, region, port, url, results });
      } catch (e) {
        const msg = e instanceof Error ? e.message.substring(0, 80) : String(e);
        results.push({ region, port, status: "FAIL", error: msg });
      }
    }
  }

  return NextResponse.json({ found: false, results });
}
