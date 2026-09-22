import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Whitelist of allowed settings keys + their validators.
 *
 * This list mirrors the DEFAULTS object in src/components/dashboard/views/settings.tsx
 * — keeping it server-side prevents the client from writing arbitrary keys
 * (e.g. hidden feature flags) into SystemSetting.
 *
 * Validators return `{ ok: true }` or `{ ok: false, error: "..." }`.
 * Unknown keys are rejected with a 400.
 */
type ValidationResult = { ok: true } | { ok: false; error: string };

const NUMERIC_KEYS = new Set([
  "tax_rate",
  "production_lead_days",
  "sheet_size_sqm",
]);

function validateKey(key: string, value: string): ValidationResult {
  // Numeric validation
  if (NUMERIC_KEYS.has(key)) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      const label = key.replace(/_/g, " ");
      return { ok: false, error: `${label} must be a number (got "${value}")` };
    }
    if (n < 0) {
      const label = key.replace(/_/g, " ");
      return { ok: false, error: `${label} cannot be negative` };
    }
    // Domain-specific caps
    if (key === "tax_rate" && n > 100) {
      return { ok: false, error: "Tax rate cannot exceed 100%" };
    }
    if (key === "production_lead_days" && n > 365) {
      return {
        ok: false,
        error: "Production lead days cannot exceed 365 days",
      };
    }
    if (key === "sheet_size_sqm" && (n < 0.1 || n > 100)) {
      return {
        ok: false,
        error: "Sheet size must be between 0.1 and 100 m²",
      };
    }
    return { ok: true };
  }

  // Currency — 3-letter ISO 4217 code
  if (key === "currency") {
    if (!/^[A-Z]{3}$/.test(value)) {
      return {
        ok: false,
        error: "Currency must be a 3-letter ISO code (e.g. USD, EUR, GBP)",
      };
    }
    return { ok: true };
  }

  // Email validation
  if (key === "contact_email") {
    // Allow empty (no contact email configured)
    if (!value) return { ok: true };
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!emailOk) {
      return { ok: false, error: `Contact email is not a valid email address` };
    }
    return { ok: true };
  }

  // All other whitelisted keys accept any string (no specific format).
  return { ok: true };
}

const ALLOWED_KEYS = new Set<string>([
  "factory_name",
  "default_material",
  "default_thickness",
  "default_edge_banding",
  "standard_ceiling_ht",
  "production_lead_days",
  "sheet_size_sqm",
  "currency",
  "tax_rate",
  "contact_phone",
  "contact_email",
  "address",
  "workshop_address",
  "notes",
]);

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.systemSetting.findMany();
  const settings = rows.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.value ?? "";
    return acc;
  }, {});
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as Record<string, string>;
  const keys = Object.keys(body);

  // 1. Whitelist enforcement
  const unknown = keys.filter((k) => !ALLOWED_KEYS.has(k));
  if (unknown.length > 0) {
    return NextResponse.json(
      {
        error: `Unknown setting key(s): ${unknown.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // 2. Validate each value
  for (const key of keys) {
    const value = body[key] ?? "";
    const result = validateKey(key, value);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }

  // 3. Fetch old values for audit diff (only for keys we're about to change)
  const oldRows = await db.systemSetting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  });
  const oldMap = new Map(oldRows.map((r) => [r.key, r.value ?? ""]));

  // 4. Persist
  for (const key of keys) {
    const value = body[key] ?? "";
    await db.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { id: key, key, value },
    });
  }

  // 5. Audit with before/after diff
  const changes = keys.map((k) => ({
    key: k,
    oldValue: oldMap.get(k) ?? "",
    newValue: body[k] ?? "",
  }));
  await recordAudit({
    action: "update",
    entityType: "settings",
    actor: session,
    summary: `System settings updated by ${session.fullName} (${keys.length} key${keys.length === 1 ? "" : "s"})`,
    details: { changes },
  });
  return NextResponse.json({ ok: true });
}
