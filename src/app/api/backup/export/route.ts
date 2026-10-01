import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canBackup } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

const BACKUP_DIR = join(process.cwd(), "backups");

// All Prisma model names for export
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

// Fields to strip from each model during export. The User.password column
// contains bcrypt hashes and must NEVER be exported — a stolen backup would
// otherwise allow offline cracking.
const EXCLUDED_FIELDS: Record<string, Set<string>> = {
  user: new Set(["password"]),
};

function serializeRecord(model: string, r: any): Record<string, unknown> {
  const excluded = EXCLUDED_FIELDS[model];
  const serialized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (excluded?.has(k)) continue;
    if (v !== null && typeof v === "object" && "toString" in v && typeof v.toString === "function") {
      // Prisma Decimal — convert to number
      const numVal = Number(v.toString());
      serialized[k] = Number.isFinite(numVal) ? numVal : v.toString();
    } else if (v instanceof Date) {
      serialized[k] = v.toISOString();
    } else {
      serialized[k] = v;
    }
  }
  return serialized;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Backup is SuperAdmin/Admin/Manager (see canBackup() in src/lib/auth.ts).
  // Restore remains SuperAdmin-only — see /api/backup/import.
  if (!canBackup(session.role))
    return NextResponse.json({ error: "Forbidden — admin access required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "download";

  // Export all tables
  const data: Record<string, unknown[]> = {};
  for (const model of MODELS) {
    try {
      // For the user model, use select to omit the password hash at the
      // Prisma layer (defense in depth — never trust the serializer alone).
      const findArgs =
        model === "user"
          ? {
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
            }
          : undefined;
      const records = await (db as any)[model].findMany(findArgs);
      data[model] = records.map((r: any) => serializeRecord(model, r));
    } catch {
      // Model might not exist yet — skip
      data[model] = [];
    }
  }

  const backup = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    exportedBy: session.id,
    models: MODELS.length,
    totalRecords: Object.values(data).reduce((s, arr) => s + arr.length, 0),
    data,
  };

  if (action === "list") {
    // List existing backup files
    try {
      const files = await readdir(BACKUP_DIR);
      const backups = files
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const match = f.match(/backup-(\d{4}-\d{2}-\d{2})-(.+)\.json/);
          return {
            filename: f,
            date: match?.[1] ?? "unknown",
            type: match?.[2] ?? "manual",
          };
        })
        .sort((a, b) => b.filename.localeCompare(a.filename));
      return NextResponse.json({ backups, current: backup.timestamp });
    } catch {
      return NextResponse.json({ backups: [], current: backup.timestamp });
    }
  }

  // Save backup to disk
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const filename = `backup-${dateStr}-${timeStr}.json`;
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));
  } catch (e) {
    console.error("[backup] Failed to save to disk:", e);
  }

  // Return as downloadable JSON
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const buffer = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

// Auto-backup (called internally from logout)
export async function autoBackup(userId: string) {
  try {
    const data: Record<string, unknown[]> = {};
    for (const model of MODELS) {
      try {
        const findArgs =
          model === "user"
            ? {
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
              }
            : undefined;
        const records = await (db as any)[model].findMany(findArgs);
        data[model] = records.map((r: any) => serializeRecord(model, r));
      } catch {
        data[model] = [];
      }
    }

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      exportedBy: userId,
      type: "auto-logout",
      models: MODELS.length,
      totalRecords: Object.values(data).reduce((s, arr) => s + arr.length, 0),
      data,
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");
    const filename = `backup-${dateStr}-${timeStr}-auto.json`;
    await mkdir(BACKUP_DIR, { recursive: true });
    await writeFile(join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));
    return true;
  } catch (e) {
    console.error("[backup] Auto-backup failed:", e);
    return false;
  }
}
