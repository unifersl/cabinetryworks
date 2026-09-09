import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * GET /api/users — list all users (Admin/SuperAdmin only).
 */
export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
      status: true,
      email: true,
      phone: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ users });
});

/**
 * POST /api/users — primary create handler (mimics the Supabase RPC
 * `admin_create_user`). Accepts a frontend-generated UUID in `id` / `p_id`
 * to guarantee non-null id constraints are satisfied. Validates uniqueness
 * and hashes the password. If this handler fails for any reason the frontend
 * is expected to fall back to POST /api/users/direct.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Use the frontend-supplied UUID (matches Supabase blueprint pattern).
    const id =
      String(body?.id ?? "").trim() || String(body?.p_id ?? "").trim() || randomUUID();

    const username = String(body?.username ?? "").trim();
    const fullName = String(body?.full_name ?? body?.fullName ?? "").trim();
    const password = String(body?.password ?? "");
    const role = String(body?.role ?? "Technician");
    const status = String(body?.status ?? "active");
    const email = body?.email ? String(body.email).trim() : null;
    const phone = body?.phone ? String(body.phone).trim() : null;

    // Validation
    const errors: string[] = [];
    if (!username) errors.push("Username is required");
    if (!fullName) errors.push("Full name is required");
    if (!password || password.length < 6)
      errors.push("Password must be at least 6 characters");
    if (!["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor", "Technician"].includes(role))
      errors.push("Invalid role");
    if (errors.length) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }

    // Uniqueness check
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
        email,
        phone,
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

    await recordAudit({
      action: "create",
      entityType: "user",
      entityId: created.id,
      actor: session,
      summary: `Created user @${created.username} (${created.fullName}) as ${created.role}`,
      details: { username: created.username, role: created.role, status: created.status },
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    console.error("[users/POST] primary handler failed:", err);
    // Return a structured error so the frontend can trigger its fallback path.
    return NextResponse.json(
      {
        error: "Primary create handler failed",
        fallback: "/api/users/direct",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 }
    );
  }
});
