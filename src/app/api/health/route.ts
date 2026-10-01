import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/health — lightweight liveness probe.
 *
 * No auth required. Returns only the bare minimum needed for uptime
 * monitoring — never leaks user counts, DB error text, or any other
 * internal state that an attacker could use for reconnaissance.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
