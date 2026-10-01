import type { Role } from "@/lib/types";
import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { User } from "@prisma/client";
import * as crypto from "crypto";

/**
 * Cookie-based session with HMAC-SHA256 signature.
 *
 * Session token format: `base64(payload) + "." + hex(hmac_sha256(base64(payload)))`.
 * The HMAC prevents tampering — without the secret an attacker cannot forge a
 * valid token, even if they can read the (base64-encoded) payload.
 *
 * The secret is `process.env.SESSION_SECRET`. If unset, a derived fallback is
 * used so the app keeps working in dev, but a console warning is emitted.
 * Always set SESSION_SECRET in production.
 */

export type SessionUser = Pick<
  User,
  "id" | "username" | "fullName" | "role" | "status"
>;

const SESSION_COOKIE = "kcm_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours (session timeout)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity → auto-logout

/**
 * Resolve the HMAC secret. If SESSION_SECRET is not provided, derive a
 * per-deployment fallback so dev environments work without configuration —
 * but warn loudly that it must be set for production.
 */
const SESSION_SECRET: string = process.env.SESSION_SECRET
  ? String(process.env.SESSION_SECRET)
  : (() => {
      if (process.env.NODE_ENV === "production") {
        console.warn(
          "[auth] SESSION_SECRET not set — using derived fallback. Set SESSION_SECRET env var for production."
        );
      }
      return crypto
        .createHash("sha256")
        .update("kcm-fallback-" + (process.env.DATABASE_URL || "dev"))
        .digest("hex");
    })();

function sign(payloadB64: string): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("hex");
}

function encode(s: Record<string, unknown>): string {
  const payloadB64 = Buffer.from(JSON.stringify(s), "utf-8").toString("base64");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Decode AND verify the HMAC signature. Returns null on any failure
 * (malformed, missing signature, bad signature). Treat invalid tokens as
 * "not logged in" rather than throwing.
 */
function decodeAndVerify<T = Record<string, unknown>>(token: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const payloadB64 = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  // Timing-safe comparison of the expected vs provided HMAC.
  const expected = sign(payloadB64);
  try {
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8")) as T;
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
    status: user.status,
    ts: Date.now(),
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Verify HMAC signature — rejects forged/tampered tokens.
  const payload = decodeAndVerify<{
    uid: string;
    role: string;
    username: string;
    fullName: string;
    status?: string;
    ts: number;
  }>(token);
  if (!payload?.uid) return null;

  // Session timeout: if session is older than 8 hours, it's expired
  const sessionAge = Date.now() - (payload.ts ?? 0);
  if (sessionAge > SESSION_MAX_AGE * 1000) return null; // Session expired

  // Cache the session for a short window (60s) to avoid a DB hit on every
  // API call. Previously this was 5 minutes — too long for status/role
  // changes (demoted/suspended users kept access). 60s is a safe compromise.
  const MAX_CACHE_AGE = 60 * 1000; // 60 seconds

  if (sessionAge < MAX_CACHE_AGE) {
    return {
      id: payload.uid,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role as SessionUser["role"],
      status: (payload.status ?? "active") as SessionUser["status"],
    };
  }

  // Re-validate against DB for older sessions. Suspended / inactive users
  // are denied access immediately rather than waiting for the cache to expire.
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
