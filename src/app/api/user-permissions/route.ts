import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * GET /api/user-permissions?userId=xxx
 * Returns all permission overrides for a user (or all users if no userId).
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.role))
    return NextResponse.json({ error: "Forbidden — SuperAdmin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  const where = userId ? { userId } : {};
  const perms = await db.userPermission.findMany({
    where,
    include: { user: { select: { id: true, fullName: true, username: true, role: true } } },
    orderBy: { userId: "asc" },
  });

  return NextResponse.json({ permissions: perms });
});

/**
 * PUT /api/user-permissions
 * Body: { userId, moduleId, allowed }
 * Sets or updates a single permission override for a user.
 */
export const PUT = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.role))
    return NextResponse.json({ error: "Forbidden — SuperAdmin only" }, { status: 403 });

  const body = await req.json();
  const userId = String(body?.userId ?? "");
  const moduleId = String(body?.moduleId ?? "");
  const allowed = Boolean(body?.allowed);

  if (!userId || !moduleId) {
    return NextResponse.json({ error: "userId and moduleId are required" }, { status: 400 });
  }

  // Can't modify SuperAdmin's own permissions (they always have full access)
  const targetUser = await db.user.findUnique({ where: { id: userId }, select: { role: true, fullName: true } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (targetUser.role === "SuperAdmin") {
    return NextResponse.json({ error: "Cannot modify SuperAdmin permissions — they always have full access" }, { status: 400 });
  }

  const perm = await db.userPermission.upsert({
    where: { userId_moduleId: { userId, moduleId } },
    create: { id: randomUUID(), userId, moduleId, allowed },
    update: { allowed },
  });

  await recordAudit({
    action: "update",
    entityType: "user_permission",
    entityId: perm.id,
    actor: session,
    summary: `${allowed ? "Granted" : "Revoked"} module "${moduleId}" for ${targetUser.fullName}`,
    details: { userId, moduleId, allowed },
  });

  return NextResponse.json({ permission: perm });
});

/**
 * DELETE /api/user-permissions?userId=xxx&moduleId=yyy
 * Removes a permission override (reverts to role-based default).
 */
export const DELETE = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.role))
    return NextResponse.json({ error: "Forbidden — SuperAdmin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const moduleId = searchParams.get("moduleId");

  if (!userId || !moduleId) {
    return NextResponse.json({ error: "userId and moduleId are required" }, { status: 400 });
  }

  await db.userPermission.deleteMany({ where: { userId, moduleId } });

  await recordAudit({
    action: "delete",
    entityType: "user_permission",
    entityId: `${userId}_${moduleId}`,
    actor: session,
    summary: `Reset module "${moduleId}" to role default`,
    details: { userId, moduleId },
  });

  return NextResponse.json({ success: true });
});
