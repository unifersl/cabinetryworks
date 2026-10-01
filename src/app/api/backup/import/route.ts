// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MODELS = [
  "user", "customer", "jobOrder", "siteMeasurement", "cuttingList",
  "systemSetting", "materialPrice", "savedQuote", "inventoryItem",
  "inventoryCategory", "supplier", "purchaseOrder", "purchaseOrderItem",
  // NOTE: `auditLog` is deliberately excluded from import — allowing an
  // imported backup to overwrite the audit trail would let a SuperAdmin
  // restore a sanitized backup and erase the evidence of any prior action.
  // Audit entries are still EXPORTED (for compliance read-out), but cannot
  // be IMPORTED.
  "warehouse", "stockLot", "stockTransfer", "stockTransferItem",
  "stockAdjustment", "stockTake", "stockTakeLine", "stockRequest",
  "stockRequestLine", "goodsIssue", "goodsIssueLine", "goodsReturn",
  "goodsReturnLine", "outsidePurchase", "outsidePurchaseLine",
  "jobTimeLog", "jobTransport", "jobFoodBeverage", "jobTool",
  "jobToolIssue", "jobToolIssueLine", "jobToolReturn", "jobToolReturnLine",
  "jobExpense", "worker", "attendanceRecord",
];

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Restore is SuperAdmin-only — see canRestore() in src/lib/auth.ts and the
  // User Guide. Allowing Manager/Admin here would let a non-owner overwrite
  // the entire database (users, audit log, financials) — a P0 escalation.
  if (!isSuperAdmin(session.role))
    return NextResponse.json(
      { error: "Forbidden — SuperAdmin access required to restore a backup" },
      { status: 403 }
    );

  const body = await req.json();
  const backupData = body?.data;

  if (!backupData || typeof backupData !== "object") {
    return NextResponse.json({ error: "Invalid backup file format" }, { status: 400 });
  }

  const results: Record<string, { imported: number; skipped: number }> = {};
  let totalImported = 0;
  let totalSkipped = 0;

  // Run the entire restore in a single transaction so a partial failure
  // (e.g. a foreign-key error halfway through) rolls back the whole import
  // rather than leaving the DB in an inconsistent state.
  await db.$transaction(async (tx) => {
    // Import in dependency order (parents before children)
    for (const model of MODELS) {
      const records = (backupData as Record<string, unknown[]>)[model];
      if (!Array.isArray(records) || records.length === 0) {
        results[model] = { imported: 0, skipped: 0 };
        continue;
      }

      let imported = 0;
      let skipped = 0;

      for (const record of records) {
        try {
          // Convert ISO date strings back to Date objects
          const processed: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(record)) {
            if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
              processed[k] = new Date(v);
            } else {
              processed[k] = v;
            }
          }

          await tx[model].upsert({
            where: { id: processed.id },
            create: processed,
            update: processed,
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      results[model] = { imported, skipped };
      totalImported += imported;
      totalSkipped += skipped;
    }
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    actor: session,
    summary: `Restored database backup: ${totalImported} record(s) imported, ${totalSkipped} skipped`,
    details: { totalImported, totalSkipped, timestamp: new Date().toISOString() },
  });

  return NextResponse.json({
    ok: true,
    totalImported,
    totalSkipped,
    results,
    timestamp: new Date().toISOString(),
  });
});
