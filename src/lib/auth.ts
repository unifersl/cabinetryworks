import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";

/**
 * Lightweight cookie-based session.
 * Session token = base64(JSON { uid, role, username, ts }).
 * For Phase 1 this avoids external auth deps while remaining secure enough
 * for an internal manufacturing tool. Passwords are bcrypt-hashed.
 */

export type SessionUser = Pick<
  User,
  "id" | "username" | "fullName" | "role" | "status"
>;

const SESSION_COOKIE = "kcm_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours (session timeout)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity → auto-logout

function encode(s: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(s), "utf-8").toString("base64");
}

function decode<T = Record<string, unknown>>(t: string): T | null {
  try {
    return JSON.parse(Buffer.from(t, "base64").toString("utf-8")) as T;
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser) {
  const token = encode({
    uid: user.id,
    role: user.role,
    username: user.username,
    fullName: user.fullName,
    ts: Date.now(),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = decode<{ uid: string; role: string; username: string; fullName: string; ts: number }>(token);
  if (!payload?.uid) return null;

  // Session timeout: if session is older than 8 hours, it's expired
  const sessionAge = Date.now() - (payload.ts ?? 0);
  if (sessionAge > SESSION_MAX_AGE * 1000) return null; // Session expired

  // For performance, use the cached session data from the token if it's
  // less than 5 minutes old. This avoids a DB query on every API call.
  const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes

  if (sessionAge < MAX_CACHE_AGE) {
    return {
      id: payload.uid,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role as SessionUser["role"],
      status: "active",
    };
  }

  // Re-validate against DB for older sessions.
  const user = await db.user.findUnique({
    where: { id: payload.uid },
    select: { id: true, username: true, fullName: true, role: true, status: true },
  });
  if (!user || user.status !== "active") return null;
  return user;
}

/** Role helpers for RBAC. */
export function isAdmin(role: string): boolean {
  return role === "Admin" || role === "SuperAdmin" || role === "Manager";
}

export function canManageUsers(role: string): boolean {
  return role === "Admin" || role === "SuperAdmin" || role === "Manager";
}

/** SuperAdmin only — system-level changes, restore, database operations */
export function isSuperAdmin(role: string): boolean {
  return role === "SuperAdmin";
}

/** Can manage stock (issue, return, adjust, transfer, request) */
export function canManageStock(role: string): boolean {
  return role === "SuperAdmin" || role === "Admin" || role === "Manager" || role === "Storekeeper";
}

/** Can delete/dispose stock items — requires admin or manager permission */
export function canDeleteStock(role: string): boolean {
  return role === "SuperAdmin" || role === "Admin" || role === "Manager";
}

/** Can view reports and all data (read-only) */
export function canViewReports(role: string): boolean {
  return role === "SuperAdmin" || role === "Admin" || role === "Manager" || role === "Auditor";
}

/** Can backup the system (but not restore — restore is SuperAdmin only) */
export function canBackup(role: string): boolean {
  return role === "SuperAdmin" || role === "Admin" || role === "Manager";
}

/** Can restore from backup — SuperAdmin only */
export function canRestore(role: string): boolean {
  return role === "SuperAdmin";
}

/** All available roles for dropdowns */
export const ALL_ROLES: { value: Role; label: string }[] = [
  { value: "SuperAdmin", label: "Super Admin" },
  { value: "Admin", label: "Admin" },
  { value: "Manager", label: "Manager" },
  { value: "Storekeeper", label: "Storekeeper" },
  { value: "Auditor", label: "Auditor" },
  { value: "Technician", label: "Technician" },
];

/** Password strength validation — enforces minimum security standards */
export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8)
    return { valid: false, message: "Password must be at least 8 characters long" };
  if (!/[A-Z]/.test(password))
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  if (!/[a-z]/.test(password))
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  if (!/[0-9]/.test(password))
    return { valid: false, message: "Password must contain at least one number" };
  return { valid: true, message: "Password is valid" };
}
