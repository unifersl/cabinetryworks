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

  const data: Record<string, unknown> = {};
  if (body.fullName !== undefined) data.fullName = String(body.fullName).trim();
  if (body.role !== undefined) {
    if (!["Admin", "SuperAdmin", "Technician"].includes(body.role))
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
    if (String(body.password).length < 6)
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
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
