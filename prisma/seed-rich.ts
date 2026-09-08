/**
 * Rich seed — populates demo customers, job orders across statuses/dates,
 * site measurements, and cutting lists so charts & lists are meaningful.
 * Run: `bun run db:seed:rich`
 *
 * Idempotent: skips if a sentinel customer already exists.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const db = new PrismaClient();

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

async function main() {
  const sentinel = await db.customer.findFirst({ where: { name: "Maple Grove Residences" } });
  if (sentinel) {
    console.log("Rich seed: already applied, skipping.");
    return;
  }

  // Ensure users exist
  let admin = await db.user.findUnique({ where: { username: "admin" } });
  if (!admin) {
    admin = await db.user.create({
      data: {
        id: randomUUID(),
        username: "admin",
        fullName: "System Administrator",
        password: await bcrypt.hash("admin123", 10),
        role: "SuperAdmin",
        status: "active",
        email: "admin@kcm.local",
      },
    });
  }
  let tech = await db.user.findUnique({ where: { username: "technician" } });
  if (!tech) {
    tech = await db.user.create({
      data: {
        id: randomUUID(),
        username: "technician",
        fullName: "Site Technician",
        password: await bcrypt.hash("tech123", 10),
        role: "Technician",
        status: "active",
        email: "tech@kcm.local",
      },
    });
  }
  // Extra technicians & an admin for richer lists
  const tech2 = await db.user.create({
    data: {
      id: randomUUID(),
      username: "mwilson",
      fullName: "Marcus Wilson",
      password: await bcrypt.hash("tech123", 10),
      role: "Technician",
      status: "active",
      email: "marcus@kcm.local",
      phone: "+1 555 0210",
    },
  });
  const tech3 = await db.user.create({
    data: {
      id: randomUUID(),
      username: "lchen",
      fullName: "Linda Chen",
      password: await bcrypt.hash("tech123", 10),
      role: "Technician",
      status: "active",
      email: "linda@kcm.local",
      phone: "+1 555 0215",
    },
  });
  const admin2 = await db.user.create({
    data: {
      id: randomUUID(),
      username: "dthompson",
      fullName: "Diane Thompson",
      password: await bcrypt.hash("admin123", 10),
      role: "Admin",
      status: "active",
      email: "diane@kcm.local",
      phone: "+1 555 0110",
    },
  });
  const suspended = await db.user.create({
    data: {
      id: randomUUID(),
      username: "jrivera",
      fullName: "Javier Rivera",
      password: await bcrypt.hash("tech123", 10),
      role: "Technician",
      status: "suspended",
      email: "javier@kcm.local",
    },
  });

  // Customers
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
  const customers = [];
  for (const c of customerData) {
    customers.push(
      await db.customer.create({
        data: { id: randomUUID(), ...c, notes: null },
      })
    );
  }

  // Job orders — spread across statuses and dates (last 30 days)
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
  const techs = [tech, tech2, tech3, null];

  let orderSeq = 1;
  for (let i = 0; i < statuses.length; i++) {
    const status = statuses[i];
    const customer = pick(customers, i);
    const assignedTo = pick(techs, i);
    const createdAt = daysAgo(statuses.length - i); // older jobs first
    const deliveryDate =
      status === "Completed"
        ? daysAgo(Math.max(0, 28 - i))
        : status === "Cancelled"
          ? null
          : daysAhead(i + 3);
    await db.jobOrder.create({
      data: {
        id: randomUUID(),
        orderNumber: `KCM-${String(orderSeq).padStart(5, "0")}`,
        title: pick(titles, i),
        customerId: customer.id,
        status,
        priority: pick(priorities, i),
        assignedToId: assignedTo?.id ?? null,
        description:
          "Scope includes design, site measurement, factory cutting, assembly, and installation. Materials per customer spec.",
        deliveryDate,
        createdAt,
        updatedAt: createdAt,
      },
    });
    orderSeq++;
  }

  // Site measurements — for a subset of jobs
  const jobsForMeasurements = await db.jobOrder.findMany({
    where: { status: { in: ["Measured", "Design", "In Production", "Cutting", "Assembly", "Installation", "Completed"] } },
    take: 10,
  });
  const roomTypes = ["Kitchen", "Wardrobe", "Vanity", "Pantry", "Other"];
  for (let i = 0; i < jobsForMeasurements.length; i++) {
    const job = jobsForMeasurements[i];
    await db.siteMeasurement.create({
      data: {
        id: randomUUID(),
        jobId: job.id,
        takenById: job.assignedToId ?? tech.id,
        roomType: pick(roomTypes, i),
        wallLength: `L1:${2800 + i * 50} L2:${2200 + i * 30} L3:${1600}`,
        ceilingHt: `${2700 + (i % 3) * 50}mm`,
        notes:
          i % 2 === 0
            ? "Gas line on west wall, sink waste on south wall. Note load-bearing column."
            : "Window opening on north wall 1200mm AFF. Existing plumbing to be retained.",
        status: job.status === "Completed" ? "Approved" : "Submitted",
        createdAt: daysAgo(20 - i),
        updatedAt: daysAgo(18 - i),
      },
    });
  }

  // Cutting lists — for jobs in production onwards
  const jobsForCutting = await db.jobOrder.findMany({
    where: { status: { in: ["In Production", "Cutting", "Assembly", "Installation", "Completed"] } },
    take: 8,
  });
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
        createdById: admin.id,
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

  console.log("Rich seed complete.");
  console.log(`  Users: ${await db.user.count()}`);
  console.log(`  Customers: ${await db.customer.count()}`);
  console.log(`  Job Orders: ${await db.jobOrder.count()}`);
  console.log(`  Measurements: ${await db.siteMeasurement.count()}`);
  console.log(`  Cutting Lists: ${await db.cuttingList.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
