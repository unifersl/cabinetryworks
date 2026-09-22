import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
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
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Security: block self-promotion to SuperAdmin
  if (session.id === id && body.role === "SuperAdmin" && session.role !== "SuperAdmin") {
    return NextResponse.json(
      { error: "You cannot promote yourself to SuperAdmin." },
      { status: 403 }
    );
  }

  // Security: block self-demotion if you're the last SuperAdmin
  if (session.id === id && body.role !== undefined && body.role !== "SuperAdmin" && session.role === "SuperAdmin") {
    const superCount = await db.user.count({ where: { role: "SuperAdmin" } });
    if (superCount <= 1) {
      return NextResponse.json(
        { error: "Cannot demote the last SuperAdmin account. Promote another user first." },
        { status: 400 }
      );
    }
  }

  // Security: block demoting the last SuperAdmin (target != self)
  if (body.role !== undefined && body.role !== "SuperAdmin") {
    const target = await db.user.findUnique({ where: { id }, select: { role: true } });
    if (target?.role === "SuperAdmin") {
      const superCount = await db.user.count({ where: { role: "SuperAdmin" } });
      if (superCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote the last SuperAdmin account." },
          { status: 400 }
        );
      }
    }
  }

  // Capture original values for audit diff
  const before = await db.user.findUnique({
    where: { id },
    select: { fullName: true, role: true, status: true, email: true, phone: true, username: true },
  });

  const data: Record<string, unknown> = {};
  if (body.fullName !== undefined) data.fullName = String(body.fullName).trim();
  if (body.role !== undefined) {
    if (!["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor", "Technician"].includes(body.role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    data.role = body.role;
  }
  if (body.status !== undefined) {
    if (!["active", "suspended", "inactive"].includes(body.status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = body.status;
  }
  if (body.email !== undefined) data.email = body.email ? String(body.email) : null;
  if (body.phone !== undefined) data.phone = body.phone ? String(body.phone) : null;
  if (body.username !== undefined) data.username = String(body.username).trim();
  if (body.password) {
    if (String(body.password).length < 8)
      return NextResponse.json(
        { error: "Password must be at least 8 characters with upper, lower, and number" },
        { status: 400 }
      );
    data.password = await hashPassword(String(body.password));
  }

  try {
    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        email: true,
        phone: true,
        updatedAt: true,
      },
    });

    // Audit: record user updates (previously missing — role/status changes were invisible)
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ["fullName", "role", "status", "email", "phone", "username"] as const) {
      if (data[k] !== undefined && before && before[k] !== data[k]) {
        changes[k] = { from: before[k], to: data[k] };
      }
    }
    if (Object.keys(changes).length > 0) {
      await recordAudit({
        action: "update",
        entityType: "user",
        entityId: id,
        actor: session,
        summary: `Updated ${updated.fullName} (${updated.username})`,
        details: { changes, passwordReset: !!body.password },
      });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[users/PUT] error", err);
    return NextResponse.json(
      { error: "Update failed. The username may already be in use." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deletion & demoting the last SuperAdmin.
  if (session.id === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 }
    );
  }

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "SuperAdmin") {
    const superCount = await db.user.count({ where: { role: "SuperAdmin" } });
    if (superCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last SuperAdmin account." },
        { status: 400 }
      );
    }
  }

  try {
    // Record audit BEFORE deleting (actor = session admin, not the target user).
    await recordAudit({
      action: "delete",
      entityType: "user",
      entityId: id,
      actor: session,
      summary: `Deleted user @${target.username} (${target.fullName})`,
      details: { username: target.username, role: target.role },
    });

    // Defensive: even though the schema now has onDelete: SetNull on all User
    // relations, explicitly null-out the FKs in a transaction so the delete
    // never fails with a foreign-key violation regardless of DB state.
    await db.$transaction([
      // Unassign jobs that were assigned to this user
      db.jobOrder.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } }),
      // Detach measurements recorded by this user (data preserved, author link cleared)
      db.siteMeasurement.updateMany({ where: { takenById: id }, data: { takenById: null } }),
      // Detach cutting lists created by this user (data preserved, author link cleared)
      db.cuttingList.updateMany({ where: { createdById: id }, data: { createdById: null } }),
      // Detach audit logs authored by this user (log preserved, actor link cleared)
      db.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } }),
      // Finally, delete the user
      db.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[users/DELETE] error", err);
    return NextResponse.json(
      { error: "Failed to delete user. The user may still have linked records that could not be cleared. Try deactivating the user instead." },
      { status: 500 }
    );
  }
}
