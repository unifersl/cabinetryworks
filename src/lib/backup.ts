import { db } from "@/lib/db";
import { writeFile, mkdir, readdir, readFile } from "fs/promises";
import { join } from "path";

const BACKUP_DIR = join(process.cwd(), "backups");

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

export interface BackupData {
  version: string;
  timestamp: string;
  exportedBy: string | null;
  type?: string;
  models: number;
  totalRecords: number;
  data: Record<string, unknown[]>;
}

// Fields to exclude when serializing each model. Most importantly, never
// export the User.password column (bcrypt hashes) — that would let anyone
// with a backup file attempt offline cracking.
const EXCLUDED_FIELDS: Record<string, Set<string>> = {
  user: new Set(["password"]),
};

function serializeRecord(model: string, r: any): Record<string, unknown> {
  const excluded = EXCLUDED_FIELDS[model];
  const serialized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (excluded?.has(k)) continue;
    if (v !== null && typeof v === "object" && "toString" in v && typeof v.toString === "function") {
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

export async function createBackup(userId: string | null, type: string = "manual"): Promise<{ filename: string; totalRecords: number }> {
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
      data[model] = [];
    }
  }

  const backup: BackupData = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    exportedBy: userId,
    type,
    models: MODELS.length,
    totalRecords: Object.values(data).reduce((s, arr) => s + arr.length, 0),
    data,
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "");
  const filename = `backup-${dateStr}-${timeStr}-${type}.json`;

  await mkdir(BACKUP_DIR, { recursive: true });
  await writeFile(join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));

  return { filename, totalRecords: backup.totalRecords };
}

export async function listBackups(): Promise<Array<{ filename: string; date: string; type: string; size: number }>> {
  try {
    const files = await readdir(BACKUP_DIR);
    const backups: Array<{ filename: string; date: string; type: string; size: number }> = [];

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const match = f.match(/backup-(\d{4}-\d{2}-\d{2})-(\d{6})-(.+)\.json/);
      let date = "unknown";
      let type = "manual";

      if (match) {
        date = match[1];
        type = match[3] ?? "manual";
      }

      try {
        const content = await readFile(join(BACKUP_DIR, f), "utf-8");
        const parsed = JSON.parse(content);
        if (parsed.timestamp) {
          date = parsed.timestamp.slice(0, 10);
        }
        if (parsed.type) {
          type = parsed.type;
        }
        backups.push({
          filename: f,
          date,
          type,
          size: content.length,
        });
      } catch {
        backups.push({ filename: f, date, type, size: 0 });
      }
    }

    return backups.sort((a, b) => b.filename.localeCompare(a.filename));
  } catch {
    return [];
  }
}
