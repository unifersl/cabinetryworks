// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

const MODELS = [
  "user", "customer", "jobOrder", "siteMeasurement", "cuttingList",
  "systemSetting", "materialPrice", "savedQuote", "inventoryItem",
  "inventoryCategory", "supplier", "purchaseOrder", "purchaseOrderItem",
  "auditLog", "warehouse", "stockLot", "stockTransfer", "stockTransferItem",
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
  if (!canManageUsers(session.role))
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });

  const body = await req.json();
  const backupData = body?.data;

  if (!backupData || typeof backupData !== "object") {
    return NextResponse.json({ error: "Invalid backup file format" }, { status: 400 });
  }

  const results: Record<string, { imported: number; skipped: number }> = {};
  let totalImported = 0;
  let totalSkipped = 0;

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

        await db[model].upsert({
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

  return NextResponse.json({
    ok: true,
    totalImported,
    totalSkipped,
    results,
    timestamp: new Date().toISOString(),
  });
});
