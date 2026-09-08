import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword, canManageUsers } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/direct — MANDATORY FALLBACK for user creation.
 *
 * This mirrors the Supabase blueprint's fallback to a direct table insert
 * when the primary RPC handler (`admin_create_user` → POST /api/users) fails.
 * It performs minimal validation and inserts directly, using the
 * frontend-supplied UUID so the non-null id constraint is never violated.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id =
      String(body?.id ?? "").trim() ||
      String(body?.p_id ?? "").trim() ||
      randomUUID();

    const username = String(body?.username ?? "").trim();
    const fullName =
      String(body?.full_name ?? body?.fullName ?? "").trim() || username;
    const password = String(body?.password ?? "");
    const role = ["Admin", "SuperAdmin", "Technician"].includes(
      String(body?.role)
    )
      ? String(body.role)
      : "Technician";
    const status = "active";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required for direct insert" },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    const hashed = await hashPassword(password);

    const created = await db.user.create({
      data: {
        id,
        username,
        fullName,
        password: hashed,
        role,
        status,
        email: body?.email ? String(body.email) : null,
        phone: body?.phone ? String(body.phone) : null,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("[users/direct] fallback insert failed:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Direct user insert failed unexpectedly",
      },
      { status: 500 }
    );
  }
}
