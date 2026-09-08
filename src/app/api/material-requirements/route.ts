import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;
  if (status) where.status = status;

  const requirements = await db.materialRequirement.findMany({
    where,
    orderBy: [{ status: "asc" }, { material: "asc" }, { createdAt: "desc" }],
    include: {
      job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
    },
  });

  // Serialize Decimal fields
  return NextResponse.json({
    requirements: requirements.map((r) => ({
      ...r,
      requiredQty: Number(r.requiredQty),
      availableQty: Number(r.availableQty),
      shortage: Number(r.shortage),
    })),
  });
});

/**
 * POST — auto-calculate material requirements from cutting lists.
 *
 * Body:
 *   { jobId: string, cuttingListId?: string, regenerate?: boolean, manual?: {...} }
 *
 * Default behaviour (auto-calc):
 *   1. Fetch all cutting lists for the jobId (or just one if cuttingListId is provided).
 *   2. Parse each cutting list's items JSON: [{ part, qty, length, width, thickness, edge }]
 *   3. For each material encountered, sum the board area required = Σ(length × width × qty).
 *   4. Look up total available stock per material from InventoryItem (Σ stockLevel).
 *   5. Create / replace MaterialRequirement rows with requiredQty / availableQty / shortage.
 *
 * If `manual` object is provided with `material` and `requiredQty`, a single manual
 * MaterialRequirement is created instead (for ad-hoc requirements not tied to a cutting list).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // -------- Manual single-row creation path --------
  if (body?.manual && body.manual.material && body.manual.requiredQty !== undefined) {
    const jobId = String(body?.jobId ?? "").trim();
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const material = String(body.manual.material).trim();
    const requiredQty = Number(body.manual.requiredQty) || 0;
    const availableQty = body.manual.availableQty !== undefined ? Number(body.manual.availableQty) || 0 : 0;
    const shortage = Math.max(0, requiredQty - availableQty);

    const requirement = await db.materialRequirement.create({
      data: {
        id: body?.id ? String(body.id) : randomUUID(),
        jobId,
        cuttingListId: body.manual.cuttingListId ? String(body.manual.cuttingListId) : null,
        material,
        requiredQty,
        availableQty,
        shortage,
        unit: body.manual.unit ? String(body.manual.unit) : "sheet",
        status: body.manual.status ? String(body.manual.status) : (shortage > 0 ? "shortage" : "fulfilled"),
        notes: body.manual.notes ? String(body.manual.notes) : null,
      },
      include: {
        job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
      },
    });

    await recordAudit({
      action: "create",
      entityType: "material_requirement",
      entityId: requirement.id,
      actor: session,
      summary: `Manual material requirement created for ${job.orderNumber}: ${material} (${requiredQty} ${requirement.unit})`,
      details: { requirementId: requirement.id, jobId, material, requiredQty, availableQty, shortage },
    });

    return NextResponse.json(
      {
        requirement: {
          ...requirement,
          requiredQty: Number(requirement.requiredQty),
          availableQty: Number(requirement.availableQty),
          shortage: Number(requirement.shortage),
        },
      },
      { status: 201 }
    );
  }

  // -------- Auto-calculation path --------
  const jobId = String(body?.jobId ?? "").trim();
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

  const job = await db.jobOrder.findUnique({ where: { id: jobId }, select: { id: true, orderNumber: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Fetch cutting lists — optionally restricted to a single one
  const cuttingListWhere: Record<string, unknown> = { jobId };
  if (body?.cuttingListId) cuttingListWhere.id = String(body.cuttingListId);

  const cuttingLists = await db.cuttingList.findMany({
    where: cuttingListWhere,
    select: { id: true, jobId: true, panelName: true, material: true, items: true },
  });

  // Aggregate per (cuttingListId, material) → required area
  type AggKey = string; // `${cuttingListId}::${material}`
  const agg = new Map<AggKey, { cuttingListId: string; material: string; requiredQty: number }>();

  for (const cl of cuttingLists) {
    const fallbackMaterial = cl.material?.trim() || "Unknown";
    let items: unknown[] = [];
    if (cl.items) {
      try {
        const parsed = JSON.parse(cl.items);
        if (Array.isArray(parsed)) items = parsed;
      } catch {
        // malformed items JSON — skip this cutting list
      }
    }

    // If cutting list has no items, still record zero-required entry? Skip if no items.
    let listTotal = 0;
    let listMaterial = fallbackMaterial;

    for (const item of items) {
      const it = item as Record<string, unknown>;
      const mat = (typeof it.material === "string" && it.material.trim()) || fallbackMaterial;
      listMaterial = mat;
      const qty = Number(it.qty ?? 1) || 1;
      const len = Number(it.length ?? 0) || 0;
      const wid = Number(it.width ?? 0) || 0;
      const area = len * wid * qty;
      listTotal += area;
    }

    if (items.length === 0) continue; // skip empty cutting lists

    const key = `${cl.id}::${listMaterial}`;
    const existing = agg.get(key);
    if (existing) {
      existing.requiredQty += listTotal;
    } else {
      agg.set(key, { cuttingListId: cl.id, material: listMaterial, requiredQty: listTotal });
    }
  }

  if (agg.size === 0) {
    return NextResponse.json(
      { message: "No cutting list items found for this job", requirements: [] },
      { status: 200 }
    );
  }

  // Build set of distinct materials to look up available stock
  const materials = Array.from(new Set(Array.from(agg.values()).map((v) => v.material)));

  // Aggregate total available stock per material from InventoryItem
  const inventoryRows = await db.inventoryItem.findMany({
    where: { material: { in: materials } },
    select: { material: true, stockLevel: true },
  });
  const availableByMaterial = new Map<string, number>();
  for (const row of inventoryRows) {
    availableByMaterial.set(row.material, (availableByMaterial.get(row.material) ?? 0) + Number(row.stockLevel));
  }

  // Optionally clear previously auto-generated requirements for this job (cuttingListId set)
  const regenerate = body?.regenerate !== false; // default true
  if (regenerate) {
    await db.materialRequirement.deleteMany({
      where: { jobId, NOT: { cuttingListId: null } },
    });
  }

  // Create new MaterialRequirement rows in a transaction
  const toCreate = Array.from(agg.values()).map((entry) => {
    const availableQty = availableByMaterial.get(entry.material) ?? 0;
    const shortage = Math.max(0, entry.requiredQty - availableQty);
    const status = shortage > 0 ? "shortage" : "fulfilled";
    return {
      id: randomUUID(),
      jobId,
      cuttingListId: entry.cuttingListId,
      material: entry.material,
      requiredQty: entry.requiredQty,
      availableQty,
      shortage,
      unit: "sqm",
      status,
      notes: null,
    };
  });

  // Use a transaction to insert all in one shot
  const created = await db.$transaction(
    toCreate.map((data) =>
      db.materialRequirement.create({
        data,
        include: {
          job: { select: { id: true, orderNumber: true, title: true, customerId: true } },
        },
      })
    )
  );

  await recordAudit({
    action: "create",
    entityType: "material_requirement",
    entityId: jobId,
    actor: session,
    summary: `Auto-generated ${created.length} material requirement(s) for ${job.orderNumber}`,
    details: {
      jobId,
      cuttingListCount: cuttingLists.length,
      materialCount: materials.length,
      regenerated: regenerate,
      rows: created.map((r) => ({
        id: r.id,
        material: r.material,
        requiredQty: Number(r.requiredQty),
        availableQty: Number(r.availableQty),
        shortage: Number(r.shortage),
        status: r.status,
      })),
    },
  });

  return NextResponse.json(
    {
      requirements: created.map((r) => ({
        ...r,
        requiredQty: Number(r.requiredQty),
        availableQty: Number(r.availableQty),
        shortage: Number(r.shortage),
      })),
      summary: {
        jobId,
        cuttingListsProcessed: cuttingLists.length,
        materials: materials.length,
        totalShortage: created.reduce((acc, r) => acc + Number(r.shortage), 0),
      },
    },
    { status: 201 }
  );
});
