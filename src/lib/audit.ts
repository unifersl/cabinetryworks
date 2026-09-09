import "server-only";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import type { SessionUser } from "@/lib/auth";

/**
 * Audit log helper — persists a record of significant actions for compliance
 * and traceability. Called from API route handlers.
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
  | "material_price";

export interface AuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  actor?: SessionUser | null;
  summary: string;
  details?: Record<string, unknown>;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
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
