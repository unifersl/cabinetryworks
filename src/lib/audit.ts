import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type { SessionUser } from "@/lib/auth";

/**
 * Audit log helper — persists a record of significant actions for compliance
 * and traceability. Called from API route handlers.
 *
 * Callers that are inside a `db.$transaction(async (tx) => { ... })` block
 * should pass `tx` so the audit write is committed (or rolled back) atomically
 * with the business mutation. Without `tx`, the audit row is written on the
 * global client OUTSIDE the transaction — a transaction rollback would leave
 * an orphaned audit entry claiming success.
 */

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "status_change"
  | "assign";

export type AuditEntityType =
  | "job"
  | "customer"
  | "user"
  | "measurement"
  | "cutting_list"
  | "auth"
  | "settings"
  | "site_visit"
  | "punch_item"
  | "change_order"
  | "communication"
  | "subcontractor"
  | "subcontractor_assignment"
  | "equipment"
  | "equipment_assignment"
  | "milestone"
  | "material_requirement"
  | "job_expense"
  | "user_permission"
  | "stock_request"
  | "goods_issue"
  | "goods_return"
  | "stock_transfer"
  | "stock_adjustment"
  | "stock_take"
  | "outside_purchase"
  | "inventory_item"
  | "warehouse"
  | "supplier"
  | "quote"
  | "material_price"
  // Extended set — covers previously-missing entity types so routes can stop
  // using the catch-all "settings" EntityType and breaking audit filtering.
  | "purchase_order"
  | "worker"
  | "attendance"
  | "production_schedule"
  | "delivery"
  | "job_document"
  | "warranty_claim"
  | "barcode"
  | "job_transport"
  | "job_food_beverage"
  | "job_time_log"
  | "job_template"
  | "qc_checkpoint";

export interface AuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  actor?: SessionUser | null;
  summary: string;
  details?: Record<string, unknown>;
  /**
   * Optional transaction client. When provided, the audit row is written via
   * `tx.auditLog.create(...)` so it participates in the caller's transaction.
   * When omitted, the global `db` client is used (audit is non-transactional).
   */
  tx?: Prisma.TransactionClient;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const client = input.tx ?? db;
  try {
    await client.auditLog.create({
      data: {
        id: randomUUID(),
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.fullName ?? null,
        summary: input.summary,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch (err) {
    // Audit logging should never break the main operation
    console.error("[audit] Failed to record:", err);
  }
}
