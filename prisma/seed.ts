/**
 * Seed script — bootstraps a SuperAdmin user so the app is usable immediately.
 * Run: `bun run db:seed`
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const db = new PrismaClient();

async function main() {
  const existing = await db.user.findUnique({ where: { username: "admin" } });
  if (existing) {
    console.log("Seed: admin user already exists, skipping.");
    return;
  }
  const password = await bcrypt.hash("admin123", 10);
  await db.user.create({
    data: {
      id: randomUUID(),
      username: "admin",
      fullName: "System Administrator",
      password,
      role: "SuperAdmin",
      status: "active",
      email: "admin@kcm.local",
      phone: "+1 555 0100",
    },
  });

  // A technician demo user
  const techPass = await bcrypt.hash("tech123", 10);
  await db.user.create({
    data: {
      id: randomUUID(),
      username: "technician",
      fullName: "Site Technician",
      password: techPass,
      role: "Technician",
      status: "active",
      email: "tech@kcm.local",
      phone: "+1 555 0200",
    },
  });

  // Create additional role demo users
  const managerPass = await bcrypt.hash("manager123", 10);
  await db.user.create({
    data: {
      id: randomUUID(),
      username: "manager",
      fullName: "Operations Manager",
      password: managerPass,
      role: "Manager",
      status: "active",
      email: "manager@kcm.local",
      phone: "+1 555 0200",
    },
  }).catch(() => console.log("Seed: manager already exists"));

  const storekeeperPass = await bcrypt.hash("store123", 10);
  await db.user.create({
    data: {
      id: randomUUID(),
      username: "storekeeper",
      fullName: "Warehouse Storekeeper",
      password: storekeeperPass,
      role: "Storekeeper",
      status: "active",
      email: "store@kcm.local",
      phone: "+1 555 0300",
    },
  }).catch(() => console.log("Seed: storekeeper already exists"));

  const auditorPass = await bcrypt.hash("audit123", 10);
  await db.user.create({
    data: {
      id: randomUUID(),
      username: "auditor",
      fullName: "Compliance Auditor",
      password: auditorPass,
      role: "Auditor",
      status: "active",
      email: "audit@kcm.local",
      phone: "+1 555 0400",
    },
  }).catch(() => console.log("Seed: auditor already exists"));

  console.log("Seed complete. Users created:");
  console.log("  admin / admin123 (SuperAdmin)");
  console.log("  manager / manager123 (Manager)");
  console.log("  storekeeper / store123 (Storekeeper)");
  console.log("  auditor / audit123 (Auditor)");
  console.log("  technician / tech123 (Technician)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
