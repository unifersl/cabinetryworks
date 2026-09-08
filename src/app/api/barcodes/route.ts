import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Auto-generate a unique barcode/QR code: `CW-XXXXXXXX` (8 hex chars from a UUID).
 * Retries on rare collision with an existing code.
 */
async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = `CW-${randomUUID().slice(0, 8).toUpperCase()}`;
    const clash = await db.barcodeLabel.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;
  }
  // Extremely unlikely — fall back to a longer suffix
  return `CW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  const jobId = searchParams.get("jobId");
  const type = searchParams.get("type");
  const printed = searchParams.get("printed");

  const where: Record<string, unknown> = {};
  if (itemId) where.itemId = itemId;
  if (jobId) where.jobId = jobId;
  if (type) where.type = type;
  if (printed === "true") where.printed = true;
  else if (printed === "false") where.printed = false;

  const labels = await db.barcodeLabel.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ labels });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // itemId / jobId are both optional; label may be generated standalone.
  const itemId = body?.itemId ? String(body.itemId).trim() || null : null;
  const jobId = body?.jobId ? String(body.jobId).trim() || null : null;

  // Optional: validate itemId / jobId exist if provided
  if (itemId) {
    const item = await db.inventoryItem.findUnique({ where: { id: itemId }, select: { id: true, name: true } });
    if (!item) return NextResponse.json({ error: "Inventory item not found" }, { status: 404 });
  }
  if (jobId) {
    const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Caller may supply an explicit code; otherwise auto-generate
  let code = body?.code ? String(body.code).trim() : null;
  if (code) {
    const clash = await db.barcodeLabel.findUnique({ where: { code } });
    if (clash) return NextResponse.json({ error: "Barcode code already exists" }, { status: 409 });
  } else {
    code = await generateUniqueCode();
  }

  const label = await db.barcodeLabel.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      itemId,
      jobId,
      code,
      type: body?.type ? String(body.type) : "qr",
      label: body?.label ? String(body.label) : null,
      printed: body?.printed !== undefined ? Boolean(body.printed) : false,
    },
  });

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: label.id,
    actor: session,
    summary: `Generated ${label.type} label ${code}`,
    details: { labelId: label.id, code, itemId, jobId, type: label.type },
  });

  return NextResponse.json({ label }, { status: 201 });
});
