// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, isSuperAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

/**
 * Demo Data API — SuperAdmin only.
 *
 * Marking convention: demo records are flagged by a "DEMO -" prefix on the
 * customer name, and on the JobOrder title. Inventory items use a "DEMO-" code
 * prefix. This makes cleanup trivial and avoids collisions with real data.
 */

const DEMO_PREFIX = "DEMO -";
const DEMO_CODE_PREFIX = "DEMO-";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + (n % 8), (n * 7) % 60, 0, 0);
  return d;
}
function daysAhead(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/* ------------------------------------------------------------------ */
/* GET /api/demo-data — hasDemoData flag                              */
/* ------------------------------------------------------------------ */
export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.role))
    return NextResponse.json({ error: "Forbidden — SuperAdmin only" }, { status: 403 });

  const demoCustomers = await db.customer.count({
    where: { name: { startsWith: DEMO_PREFIX } },
  });
  const demoJobs = await db.jobOrder.count({
    where: { title: { startsWith: DEMO_PREFIX } },
  });
  const demoInventory = await db.inventoryItem.count({
    where: { code: { startsWith: DEMO_CODE_PREFIX } },
  });

  return NextResponse.json({
    hasDemoData: demoCustomers > 0 || demoJobs > 0 || demoInventory > 0,
    counts: {
      customers: demoCustomers,
      jobs: demoJobs,
      inventory: demoInventory,
    },
  });
});

/* ------------------------------------------------------------------ */
/* POST /api/demo-data — seed or remove                                */
/* ------------------------------------------------------------------ */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.role))
    return NextResponse.json({ error: "Forbidden — SuperAdmin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").toLowerCase();

  if (action === "seed") {
    return await seedDemoData(session);
  }
  if (action === "remove") {
    return await removeDemoData(session);
  }
  return NextResponse.json(
    { error: "Invalid action. Use 'seed' or 'remove'." },
    { status: 400 }
  );
});

/* ------------------------------------------------------------------ */
/* Seed: create demo customers, jobs, measurements, inventory          */
/* ------------------------------------------------------------------ */
async function seedDemoData(session: { id: string; username: string; fullName: string; role: string }) {
  // Idempotency: skip if already seeded
  const existing = await db.customer.count({
    where: { name: { startsWith: DEMO_PREFIX } },
  });
  if (existing > 0) {
    return NextResponse.json(
      { error: "Demo data already loaded. Remove it first before re-seeding." },
      { status: 409 }
    );
  }

  // Find an admin / technician to attach demo jobs to (real users only).
  const technicians = await db.user.findMany({
    where: { role: "Technician", status: "active" },
    take: 3,
  });
  const admin = await db.user.findFirst({
    where: { role: { in: ["SuperAdmin", "Admin"] }, status: "active" },
  });
  const fallbackUserId = admin?.id ?? session.id;

  const customerData = [
    { name: "Maple Grove Residences", phone: "+1 555 1001", email: "maple@grove.com", address: "14 Maple Grove Lane, Oakville" },
    { name: "Sarah & Mike Wilson", phone: "+1 555 0300", email: "wilson@example.com", address: "42 Maple Street, Oakville" },
    { name: "Cedar Heights Cafe", phone: "+1 555 1042", email: "owner@cedarcafe.co", address: "88 Cedar Ave, Riverton" },
    { name: "Pinecrest Dental Clinic", phone: "+1 555 1077", email: "info@pinecrestdental.com", address: "3 Pinecrest Blvd, Lakeside" },
    { name: "Bayside Holiday Home", phone: "+1 555 1088", email: "stay@baysidehome.com", address: "7 Bayview Rd, Seabrook" },
    { name: "Oakwood Boutique Hotel", phone: "+1 555 1099", email: "ops@oakwoodhotel.com", address: "120 Oakwood St, Hillcrest" },
    { name: "Greenfield Family Kitchen", phone: "+1 555 1100", email: "greenfields@home.com", address: "55 Greenfield Ct, Meadowbrook" },
    { name: "Riverside Apartment 12B", phone: "+1 555 1111", email: "apt12b@riverside.com", address: "12B Riverbank Towers, Riverton" },
  ];

  const customers: { id: string; name: string }[] = [];
  for (const c of customerData) {
    const cust = await db.customer.create({
      data: {
        id: randomUUID(),
        name: `${DEMO_PREFIX}${c.name}`,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: "Demo customer — safe to delete",
      },
    });
    customers.push({ id: cust.id, name: cust.name });
  }

  // Job orders — spread across statuses and dates
  const statuses = [
    "Completed", "Completed", "Completed", "Completed",
    "Installation", "Installation",
    "Assembly", "Assembly",
    "Cutting", "Cutting",
    "In Production", "In Production", "In Production",
    "Design", "Design",
    "Measured",
    "Pending", "Pending", "Pending",
    "Cancelled",
  ];
  const priorities = ["Normal", "Normal", "Normal", "High", "High", "Urgent", "Low"];
  const titles = [
    "Kitchen renovation — Oak cabinets",
    "Wardrobe built-in — Master bedroom",
    "Vanity unit — Ensuite",
    "Pantry shelving upgrade",
    "Laundry cabinetry install",
    "Reception counter — Cafe",
    "Custom bookshelf wall",
    "Kitchen island with seating",
    "Bathroom vanity — Double basin",
    "Walk-in wardrobe fitout",
    "Office cabinetry — L-shaped",
    "Kitchen refresh — Shaker doors",
    "Media unit — Living room",
    "Linen closet built-in",
    "Bar cabinetry — Entertainment",
    "Mudroom storage bench",
    "Kitchen pantry pull-out",
    "Study desk cabinetry",
    "Bedroom wardrobe — Sliding doors",
    "Kitchen overheads + rangehood box",
    "Under-stair storage solution",
  ];

  let orderSeq = 1;
  // Pre-compute highest existing order seq to avoid collisions
  const lastJob = await db.jobOrder.findFirst({
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  if (lastJob?.orderNumber) {
    const m = lastJob.orderNumber.match(/(\d+)$/);
    if (m) orderSeq = Number(m[1]) + 1;
  }

  const createdJobs: { id: string; status: string }[] = [];
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const customer = pick(customers, i);
    const assignedTo = pick(technicians, i);
    const createdAt = daysAgo(statuses.length - i);
    const deliveryDate =
      status === "Completed"
        ? daysAgo(Math.max(0, 28 - i))
        : status === "Cancelled"
          ? null
          : daysAhead(i + 3);
    const job = await db.jobOrder.create({
      data: {
        id: randomUUID(),
        orderNumber: `KCM-${String(orderSeq).padStart(5, "0")}`,
        title: `${DEMO_PREFIX}${pick(titles, i)}`,
        customerId: customer.id,
        status,
        priority: pick(priorities, i),
        assignedToId: assignedTo?.id ?? null,
        description:
          "Demo job — scope includes design, site measurement, factory cutting, assembly, and installation. Materials per customer spec.",
        deliveryDate,
        createdAt,
        updatedAt: createdAt,
      },
    });
    createdJobs.push({ id: job.id, status });
    orderSeq++;
  }

  // Site measurements — for jobs in production onwards
  const jobsForMeasurements = createdJobs.filter((j) =>
    ["Measured", "Design", "In Production", "Cutting", "Assembly", "Installation", "Completed"].includes(j.status)
  ).slice(0, 10);
  const roomTypes = ["Kitchen", "Wardrobe", "Vanity", "Pantry", "Other"];
  for (let i = 0; i < jobsForMeasurements.length; i++) {
    const job = jobsForMeasurements[i];
    await db.siteMeasurement.create({
      data: {
        id: randomUUID(),
        jobId: job.id,
        takenById: fallbackUserId,
        roomType: pick(roomTypes, i),
        wallLength: `L1:${2800 + i * 50} L2:${2200 + i * 30} L3:${1600}`,
        ceilingHt: `${2700 + (i % 3) * 50}mm`,
        notes:
          i % 2 === 0
            ? "Demo measurement — gas line on west wall, sink waste on south wall."
            : "Demo measurement — window opening on north wall 1200mm AFF.",
        status: job.status === "Completed" ? "Approved" : "Submitted",
        createdAt: daysAgo(20 - i),
        updatedAt: daysAgo(18 - i),
      },
    });
  }

  // Cutting lists — for jobs in production onwards
  const jobsForCutting = createdJobs.filter((j) =>
    ["In Production", "Cutting", "Assembly", "Installation", "Completed"].includes(j.status)
  ).slice(0, 8);
  const materials = ["MDF", "Plywood", "Particle Board", "Solid Wood"];
  const panelNames = ["Base cabinets", "Wall cabinets", "Tall pantry", "Island unit", "Drawer banks"];
  for (let i = 0; i < jobsForCutting.length; i++) {
    const job = jobsForCutting[i];
    const items = [
      { part: "Side panel LH", qty: 2 + (i % 3), length: "720mm", width: "580mm", thickness: "18mm", edge: "1mm PVC" },
      { part: "Side panel RH", qty: 2 + (i % 3), length: "720mm", width: "580mm", thickness: "18mm", edge: "1mm PVC" },
      { part: "Base panel", qty: 1, length: "600mm", width: "560mm", thickness: "18mm", edge: "—" },
      { part: "Back panel", qty: 1, length: "600mm", width: "720mm", thickness: "6mm", edge: "—" },
      { part: "Door front", qty: 2, length: "596mm", width: "396mm", thickness: "18mm", edge: "2mm ABS" },
      { part: "Drawer front", qty: 1, length: "596mm", width: "196mm", thickness: "18mm", edge: "2mm ABS" },
      { part: "Shelf", qty: 3, length: "564mm", width: "560mm", thickness: "18mm", edge: "1mm PVC" },
    ];
    await db.cuttingList.create({
      data: {
        id: randomUUID(),
        jobId: job.id,
        createdById: fallbackUserId,
        panelName: pick(panelNames, i),
        material: pick(materials, i),
        items: JSON.stringify(items),
        status:
          job.status === "Completed" ? "Done" : job.status === "Cutting" ? "In Cutting" : "Submitted",
        createdAt: daysAgo(15 - i),
        updatedAt: daysAgo(13 - i),
      },
    });
  }

  // Inventory items + categories — useful for inventory dashboard demos
  const categories = [
    { name: "Demo Boards", description: "Demo board stock" },
    { name: "Demo Hardware", description: "Demo hardware stock" },
    { name: "Demo Edge Banding", description: "Demo edge banding stock" },
  ];
  const createdCategories: { id: string; name: string }[] = [];
  for (const c of categories) {
    // Skip if already exists
    const existingCat = await db.inventoryCategory.findUnique({ where: { name: c.name } });
    if (existingCat) {
      createdCategories.push({ id: existingCat.id, name: existingCat.name });
    } else {
      const cat = await db.inventoryCategory.create({
        data: { id: randomUUID(), name: c.name, description: c.description },
      });
      createdCategories.push({ id: cat.id, name: cat.name });
    }
  }

  // Find or create a "Demo Warehouse" so stock lots have a valid FK
  let demoWarehouse = await db.warehouse.findUnique({ where: { code: "WH-DEMO" } });
  if (!demoWarehouse) {
    demoWarehouse = await db.warehouse.create({
      data: {
        id: randomUUID(),
        code: "WH-DEMO",
        name: "Demo Warehouse",
        location: "Demo Site",
        type: "site",
        isActive: true,
      },
    });
  }

  const inventoryItems = [
    { name: "Demo MDF Board 18mm", code: "DEMO-MDF18", material: "MDF", thickness: "18mm", unit: "sheet", stock: 25, min: 5, reorder: 10, cost: 42.5, category: "Demo Boards" },
    { name: "Demo Plywood 16mm", code: "DEMO-PLY16", material: "Plywood", thickness: "16mm", unit: "sheet", stock: 12, min: 4, reorder: 8, cost: 55.0, category: "Demo Boards" },
    { name: "Demo Particle Board 18mm", code: "DEMO-PB18", material: "Particle Board", thickness: "18mm", unit: "sheet", stock: 3, min: 6, reorder: 12, cost: 28.75, category: "Demo Boards" },
    { name: "Demo Concealed Hinges", code: "DEMO-HNG-100", material: "Hardware", thickness: null, unit: "pcs", stock: 200, min: 50, reorder: 100, cost: 2.5, category: "Demo Hardware" },
    { name: "Demo Drawer Runners 450mm", code: "DEMO-DR-450", material: "Hardware", thickness: null, unit: "pcs", stock: 80, min: 20, reorder: 40, cost: 8.75, category: "Demo Hardware" },
    { name: "Demo PVC Edge Banding 1mm", code: "DEMO-EB-1MM", material: "Edge Banding", thickness: "1mm", unit: "m", stock: 150, min: 50, reorder: 100, cost: 0.85, category: "Demo Edge Banding" },
  ];

  for (const item of inventoryItems) {
    const cat = createdCategories.find((c) => c.name === item.category);
    // Skip if already exists (by name)
    const existingItem = await db.inventoryItem.findUnique({ where: { name: item.name } });
    if (existingItem) continue;
    const newItem = await db.inventoryItem.create({
      data: {
        id: randomUUID(),
        name: item.name,
        code: item.code,
        material: item.material,
        thickness: item.thickness,
        unit: item.unit,
        stockLevel: item.stock,
        minStock: item.min,
        reorderPoint: item.reorder,
        unitCost: item.cost,
        supplier: "Demo Supplier Co.",
        categoryId: cat?.id ?? null,
        status: "active",
        notes: "Demo inventory — safe to delete",
        lastRestocked: daysAgo(7),
      },
    });
    // Stock lot for traceability
    await db.stockLot.create({
      data: {
        id: randomUUID(),
        itemId: newItem.id,
        warehouseId: demoWarehouse.id,
        quantity: item.stock,
        batchNo: `DEMO-${item.code}`,
        receivedDate: daysAgo(7),
        notes: "Demo stock lot",
      },
    });
  }

  await recordAudit({
    action: "create",
    entityType: "settings",
    entityId: "demo-data-seed",
    actor: session,
    summary: `Seeded demo data (${customers.length} customers, ${createdJobs.length} jobs, ${inventoryItems.length} inventory items)`,
    details: {
      customers: customers.length,
      jobs: createdJobs.length,
      inventory: inventoryItems.length,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Demo data seeded successfully",
    counts: {
      customers: customers.length,
      jobs: createdJobs.length,
      inventory: inventoryItems.length,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Remove: delete all demo data (keeps users)                          */
/* ------------------------------------------------------------------ */
async function removeDemoData(session: { id: string; username: string; fullName: string; role: string }) {
  // Find all demo customers and their related jobs first (so we can cascade)
  const demoCustomers = await db.customer.findMany({
    where: { name: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  const demoCustomerIds = demoCustomers.map((c) => c.id);

  // Find all demo jobs (by title prefix) — includes orphan ones not tied to a demo customer
  const demoJobs = await db.jobOrder.findMany({
    where: { title: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  const demoJobIds = demoJobs.map((j) => j.id);

  // Find demo inventory items
  const demoItems = await db.inventoryItem.findMany({
    where: { code: { startsWith: DEMO_CODE_PREFIX } },
    select: { id: true },
  });
  const demoItemIds = demoItems.map((i) => i.id);

  // Find any demo categories
  const demoCats = await db.inventoryCategory.findMany({
    where: { name: { startsWith: "Demo " } },
    select: { id: true },
  });

  // Find the demo warehouse
  const demoWarehouse = await db.warehouse.findUnique({ where: { code: "WH-DEMO" } });

  const deleted = {
    customers: 0,
    jobs: 0,
    measurements: 0,
    cuttingLists: 0,
    inventory: 0,
    categories: 0,
    warehouses: 0,
  };

  // Use a transaction to ensure atomicity & correctness
  await db.$transaction(async (tx) => {
    // 1. Delete job-related children for demo jobs (cascade)
    if (demoJobIds.length > 0) {
      const mDel = await tx.siteMeasurement.deleteMany({ where: { jobId: { in: demoJobIds } } });
      const cDel = await tx.cuttingList.deleteMany({ where: { jobId: { in: demoJobIds } } });
      deleted.measurements = mDel.count;
      deleted.cuttingLists = cDel.count;
      await tx.jobTimeLog.deleteMany({ where: { jobId: { in: demoJobIds } } });
      await tx.jobTransport.deleteMany({ where: { jobId: { in: demoJobIds } } });
      await tx.jobFoodBeverage.deleteMany({ where: { jobId: { in: demoJobIds } } });
      await tx.jobExpense.deleteMany({ where: { jobId: { in: demoJobIds } } });
      // JobOrder deletion cascades most others via onDelete: Cascade in the schema
      const jobDel = await tx.jobOrder.deleteMany({ where: { id: { in: demoJobIds } } });
      deleted.jobs = jobDel.count;
    }

    // 2. Delete demo customers
    if (demoCustomerIds.length > 0) {
      const custDel = await tx.customer.deleteMany({ where: { id: { in: demoCustomerIds } } });
      deleted.customers = custDel.count;
    }

    // 3. Delete demo inventory items (stock lots cascade)
    if (demoItemIds.length > 0) {
      const itemDel = await tx.inventoryItem.deleteMany({ where: { id: { in: demoItemIds } } });
      deleted.inventory = itemDel.count;
    }

    // 4. Delete demo categories
    if (demoCats.length > 0) {
      const catDel = await tx.inventoryCategory.deleteMany({
        where: { id: { in: demoCats.map((c) => c.id) } },
      });
      deleted.categories = catDel.count;
    }

    // 5. Delete the demo warehouse (stock lots already cascaded via item delete)
    if (demoWarehouse) {
      // Ensure no stock lots remain attached
      await tx.stockLot.deleteMany({ where: { warehouseId: demoWarehouse.id } });
      await tx.warehouse.delete({ where: { id: demoWarehouse.id } });
      deleted.warehouses = 1;
    }
  });

  await recordAudit({
    action: "delete",
    entityType: "settings",
    entityId: "demo-data-remove",
    actor: session,
    summary: `Removed demo data (${deleted.customers} customers, ${deleted.jobs} jobs, ${deleted.inventory} inventory items)`,
    details: deleted,
  });

  return NextResponse.json({
    ok: true,
    message: "Demo data removed successfully",
    deleted,
  });
}
