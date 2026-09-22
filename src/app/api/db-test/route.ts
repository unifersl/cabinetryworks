import { NextResponse } from "next/server";
import { Pool } from 'pg';

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const passwords = ['*nDwopXdNXu3Ykcw', 'ciCJU2AnYRN6vH*7'];
  const results: any[] = [];

  for (const pwd of passwords) {
    try {
      const pool = new Pool({
        host: 'aws-0-ap-southeast-2.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: 'postgres.bxcelvhzzfqkcmmekaek',
        password: pwd,
        max: 1,
        connectionTimeoutMillis: 10000,
      });
      const client = await pool.connect();
      const res = await client.query('SELECT count(*) FROM information_schema.tables WHERE table_schema = $1', ['public']);
      client.release();
      await pool.end();
      return NextResponse.json({
        found: true,
        password: pwd[0] + '***' + pwd.slice(-3),
        tableCount: res.rows[0].count,
        message: "Connection works!"
      });
    } catch (e) {
      results.push({
        password: pwd[0] + '***' + pwd.slice(-3),
        error: e instanceof Error ? e.message.substring(0, 100) : String(e)
      });
    }
  }

  return NextResponse.json({ found: false, results });
}
