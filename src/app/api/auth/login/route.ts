import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Simple in-memory login rate limiter.
 *
 * Limits each IP to MAX_ATTEMPTS login attempts per WINDOW_MS. The state is
 * process-local — sufficient for a single-instance deployment. In a
 * multi-instance setup, swap this for a shared store (Redis, Upstash, etc).
 *
 * On a successful login we clear the IP's counter; on failure we increment
 * it. When the limit is exceeded we return 429 with a Retry-After header
 * so well-behaved clients back off automatically.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type AttemptRecord = { count: number; firstAttempt: number };
const attempts = new Map<string, AttemptRecord>();

// Periodically purge stale entries so the Map doesn't grow unboundedly.
// (This runs only when a login request comes in — there's no timer.)
const PURGE_INTERVAL_MS = 5 * 60 * 1000;
let lastPurge = 0;

function pruneStale(now: number) {
  if (now - lastPurge < PURGE_INTERVAL_MS) return;
  lastPurge = now;
  for (const [ip, rec] of attempts) {
    if (now - rec.firstAttempt > WINDOW_MS) attempts.delete(ip);
  }
}

function clientIp(req: NextRequest): string {
  // Prefer `x-real-ip` — it's set by our trusted reverse proxy (Caddy) and
  // cannot be spoofed by the client. Only fall back to `x-forwarded-for`
  // (which CAN be spoofed) if `x-real-ip` is absent. When we do fall back to
  // XFF, we take the FIRST (leftmost) IP and strip whitespace, since that
  // entry is the closest to the client in the proxy chain.
  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) {
    const trimmed = xRealIp.trim();
    if (trimmed) return trimmed;
  }

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  // Neither header present — we can't identify the client. Log a warning so
  // ops knows the rate limiter is effectively disabled for these requests
  // (every request looks like "unknown" so they all share one bucket).
  console.warn("[auth/login] no x-real-ip or x-forwarded-for header present — rate limit cannot identify client");
  return "unknown";
}

export async function POST(req: NextRequest) {
  // ---- Rate limiting -----------------------------------------------------
  const ip = clientIp(req);
  const now = Date.now();
  pruneStale(now);

  const rec = attempts.get(ip);
  if (rec) {
    // Reset if the window has elapsed since the first attempt.
    if (now - rec.firstAttempt > WINDOW_MS) {
      attempts.set(ip, { count: 1, firstAttempt: now });
    } else if (rec.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((rec.firstAttempt + WINDOW_MS - now) / 1000);
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(retryAfterSec, 1)),
          },
        }
      );
    } else {
      rec.count += 1;
    }
  } else {
    attempts.set(ip, { count: 1, firstAttempt: now });
  }

  // ---- Login logic (unchanged) ------------------------------------------
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: "Account is not active. Contact an administrator." },
        { status: 403 }
      );
    }

    await createSession(user);

    // Successful login — clear the IP's rate-limit counter so the user
    // doesn't carry over a partially-used budget from earlier failures.
    attempts.delete(ip);

    await recordAudit({
      action: "login",
      entityType: "auth",
      entityId: user.id,
      actor: { id: user.id, username: user.username, fullName: user.fullName, role: user.role, status: user.status },
      summary: `${user.fullName} (@${user.username}) signed in`,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    // Provide a more helpful error so we can debug on Vercel
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth/login] error:", message);
    return NextResponse.json(
      { error: `Login failed: ${message}` },
      { status: 500 }
    );
  }
}
