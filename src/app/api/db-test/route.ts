import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const PASSWORD = encodeURIComponent("ciCJU2AnYRN6vH*7");
const PROJECT_REF = "bxcelvhzzfqkcmmekaek";

const URLS_TO_TRY = [
  // New format: no region in hostname
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${PROJECT_REF}.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@${PROJECT_REF}.pooler.supabase.com:5432/postgres`,
  // Direct connection
  `postgresql://postgres:${PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  // Old format with common regions
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
];

export async function GET() {
  const results: any[] = [];

  for (let i = 0; i < URLS_TO_TRY.length; i++) {
    const url = URLS_TO_TRY[i];
    try {
      const client = new PrismaClient({ datasourceUrl: url });
      const tables: any[] = await client.$queryRaw`SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'`;
      await client.$disconnect();
      return NextResponse.json({ 
        found: true, 
        urlIndex: i,
        url: url.replace(PASSWORD, '***'),
        tableCount: tables[0]?.cnt,
        message: "Connection works!"
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.substring(0, 100) : String(e).substring(0, 100);
      results.push({ index: i, error: msg });
    }
  }

  return NextResponse.json({ found: false, results });
}
