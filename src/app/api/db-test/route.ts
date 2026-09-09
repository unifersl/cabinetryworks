import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const PASSWORD = encodeURIComponent("ciCJU2AnYRN6vH*7");
const PROJECT_REF = "bxcelvhzzfqkcmmekaek";

// Most likely regions for Sri Lanka users
const REGIONS = ["ap-southeast-1", "ap-northeast-1", "ap-south-1", "eu-west-1", "us-east-1"];

export async function GET() {
  const results: any[] = [];

  for (const region of REGIONS) {
    for (const port of [6543, 5432]) {
      const url = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
      try {
        const client = new PrismaClient({ datasourceUrl: url });
        const count = await client.user.count();
        await client.$disconnect();
        return NextResponse.json({ 
          found: true, 
          region, 
          port, 
          url,
          userCount: count,
          results: [...results, { region, port, status: "WORKS" }]
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message.substring(0, 60) : String(e).substring(0, 60);
        results.push({ region, port, status: "FAIL", error: msg });
      }
    }
  }

  return NextResponse.json({ found: false, results });
}
