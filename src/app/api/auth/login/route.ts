import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
