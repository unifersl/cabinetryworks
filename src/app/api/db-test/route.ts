import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const PASSWORD = encodeURIComponent("ciCJU2AnYRN6vH*7");
const PROJECT_REF = "bxcelvhzzfqkcmmekaek";

const REGIONS = [
  "ap-southeast-1", "ap-northeast-1", "ap-south-1", 
  "eu-west-1", "eu-central-1", "us-east-1", "us-west-1",
  "sa-east-1", "ca-central-1", "af-south-1",
  "eu-west-2", "us-west-2", "ap-east-1",
];

export async function GET() {
  const results: any[] = [];

  for (const region of REGIONS) {
    for (const port of [6543, 5432]) {
      const url = `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-${region}.pooler.supabase.com:${port}/postgres`;
      try {
        const client = new PrismaClient({ datasourceUrl: url });
        // Try raw SQL first — don't assume tables exist
        const tables: any[] = await client.$queryRaw`
          SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5
        `;
        await client.$disconnect();
        return NextResponse.json({ 
          found: true, 
          region, 
          port, 
          url,
          tables: tables.map((t: any) => t.table_name),
          message: "Connection works!"
        });
      } catch (e) {
        const fullError = e instanceof Error ? e.message : String(e);
        results.push({ 
          region, 
          port, 
          error: fullError.substring(0, 150) 
        });
      }
    }
  }

  // Also try direct connection
  const directUrl = `postgresql://postgres:${PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  try {
    const client = new PrismaClient({ datasourceUrl: directUrl });
    const tables: any[] = await client.$queryRaw`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5
    `;
    await client.$disconnect();
    return NextResponse.json({ 
      found: true, 
      region: "direct", 
      port: 5432, 
      url: directUrl,
      tables: tables.map((t: any) => t.table_name),
      message: "Direct connection works!"
    });
  } catch (e) {
    const fullError = e instanceof Error ? e.message : String(e);
    results.push({ 
      region: "direct", 
      port: 5432, 
      error: fullError.substring(0, 150) 
    });
  }

  return NextResponse.json({ found: false, results });
}
