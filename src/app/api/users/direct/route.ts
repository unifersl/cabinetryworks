import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  hashPassword,
  canManageUsers,
  isSuperAdmin,
  validatePassword,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/users/direct — MANDATORY FALLBACK for user creation.
 *
 * This mirrors the Supabase blueprint's fallback to a direct table insert
 * when the primary RPC handler (`admin_create_user` → POST /api/users) fails.
 * It performs minimal validation and inserts directly, using the
 * frontend-supplied UUID so the non-null id constraint is never violated.
 *
 * SECURITY: this route is reachable from the client (create-user-dialog.tsx)
 * and previously granted SuperAdmin to any Manager who triggered the fallback
 * path. It now enforces:
 *   - canManageUsers (Admin/SuperAdmin/Manager) — same as the primary route.
 *   - SuperAdmin creation only by a SuperAdmin (privilege-escalation guard).
 *   - validatePassword (matches the rest of the app's strength rules).
 *   - recordAudit (the primary route already audited; this one didn't).
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
    const role = ["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor", "Technician"].includes(
      String(body?.role)
    )
      ? String(body.role)
      : "Technician";
    const status = "active";

    // Security: only SuperAdmin can create new SuperAdmin accounts.
    if (role === "SuperAdmin" && !isSuperAdmin(session.role)) {
      return NextResponse.json(
        { error: "Only a SuperAdmin can create a SuperAdmin account." },
        { status: 403 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required for direct insert" },
        { status: 400 }
      );
    }

    // Enforce the same password strength rules as the rest of the app.
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.valid) {
      return NextResponse.json({ error: pwdCheck.message }, { status: 400 });
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

    await recordAudit({
      action: "create",
      entityType: "user",
      entityId: created.id,
      actor: session,
      summary: `Created user @${created.username} (${created.fullName}) as ${created.role} (direct fallback)`,
      details: { username: created.username, role: created.role, status: created.status },
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
