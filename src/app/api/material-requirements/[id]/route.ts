import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

export const PUT = apiHandler(async (
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.materialRequirement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.material !== undefined) data.material = String(body.material);
  if (body.cuttingListId !== undefined) data.cuttingListId = body.cuttingListId ? String(body.cuttingListId) : null;
  if (body.unit !== undefined) data.unit = String(body.unit);
  if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
  if (body.status !== undefined) data.status = String(body.status);

  // Recalculate shortage if required or available changed
  let requiredQty = Number(existing.requiredQty);
  let availableQty = Number(existing.availableQty);
  if (body.requiredQty !== undefined) requiredQty = Number(body.requiredQty) || 0;
  if (body.availableQty !== undefined) availableQty = Number(body.availableQty) || 0;
  if (body.requiredQty !== undefined || body.availableQty !== undefined) {
    data.requiredQty = requiredQty;
    data.availableQty = availableQty;
    data.shortage = Math.max(0, requiredQty - availableQty);
    // Auto-update status if it wasn't explicitly provided
    if (body.status === undefined) {
      data.status = requiredQty > availableQty ? "shortage" : "fulfilled";
    }
  }

  const requirement = await db.materialRequirement.update({
    where: { id },
    data,
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  await recordAudit({
    action: "update",
    entityType: "material_requirement",
    entityId: id,
    actor: session,
    summary: `Updated material requirement for ${requirement.material} (${requirement.status})`,
    details: {
      requirementId: id,
      jobId: existing.jobId,
      material: existing.material,
      changes: Object.keys(data),
    },
  });

  return NextResponse.json({
    requirement: {
      ...requirement,
      requiredQty: Number(requirement.requiredQty),
      availableQty: Number(requirement.availableQty),
      shortage: Number(requirement.shortage),
    },
  });
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.materialRequirement.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.materialRequirement.delete({ where: { id } });

  await recordAudit({
    action: "delete",
    entityType: "material_requirement",
    entityId: id,
    actor: session,
    summary: `Deleted material requirement for ${existing.material}`,
    details: {
      requirementId: id,
      jobId: existing.jobId,
      material: existing.material,
      requiredQty: Number(existing.requiredQty),
    },
  });

  return NextResponse.json({ ok: true });
});
