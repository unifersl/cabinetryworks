import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROJECT_REF = "bxcelvhzzfqkcmmekaek";

// Try multiple password encodings + username formats
const URLS_TO_TRY = [
  // Pooler with encoded password (* = %2A)
  `postgresql://postgres.${PROJECT_REF}:ciCJU2AnYRN6vH%2A7@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  // Pooler with raw password
  `postgresql://postgres.${PROJECT_REF}:ciCJU2AnYRN6vH*7@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
  // Direct with encoded password
  `postgresql://postgres:ciCJU2AnYRN6vH%2A7@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  // Direct with raw password
  `postgresql://postgres:ciCJU2AnYRN6vH*7@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  // Pooler us-east-1 with encoded
  `postgresql://postgres.${PROJECT_REF}:ciCJU2AnYRN6vH%2A7@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  // Pooler eu-west-1 with encoded
  `postgresql://postgres.${PROJECT_REF}:ciCJU2AnYRN6vH%2A7@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
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
        tableCount: Number(tables[0]?.cnt),
        message: "Connection works!"
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.substring(0, 120) : String(e).substring(0, 120);
      results.push({ index: i, error: msg });
    }
  }

  return NextResponse.json({ found: false, results });
}
