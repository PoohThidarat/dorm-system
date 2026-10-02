import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// หน้าที่ของไฟล์: สร้าง Demo Data สำหรับ Development (spec ข้อ 33)
// รันด้วย: npm run prisma:seed
// Phase 1 seed: Roles + 3 demo users (admin/tenant/technician)
// ห้องพัก/สัญญา/บิล ฯลฯ จะถูกเพิ่มใน seed อีกครั้งตอน Phase 2-5

const prisma = new PrismaClient();

async function main() {
  const roleNames = ["SUPER_ADMIN", "ADMIN", "TENANT", "TECHNICIAN"] as const;

  const roles: Record<string, { id: number }> = {};
  for (const name of roleNames) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const demoPasswordHash = await bcrypt.hash("Password123!", 12);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      passwordHash: demoPasswordHash,
      firstName: "Admin",
      lastName: "Demo",
      roleId: roles.SUPER_ADMIN.id,
    },
  });

  const tenantUser = await prisma.user.upsert({
    where: { email: "tenant@example.com" },
    update: {},
    create: {
      email: "tenant@example.com",
      passwordHash: demoPasswordHash,
      firstName: "Tenant",
      lastName: "Demo",
      roleId: roles.TENANT.id,
    },
  });

  await prisma.tenant.upsert({
    where: { userId: tenantUser.id },
    update: {},
    create: {
      userId: tenantUser.id,
      nationalId: "1000000000001",
    },
  });

  const techUser = await prisma.user.upsert({
    where: { email: "technician@example.com" },
    update: {},
    create: {
      email: "technician@example.com",
      passwordHash: demoPasswordHash,
      firstName: "Technician",
      lastName: "Demo",
      roleId: roles.TECHNICIAN.id,
    },
  });

  await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {},
    create: {
      userId: techUser.id,
      specialty: "ทั่วไป",
    },
  });

  console.log("✅ Seed สำเร็จ: admin@example.com / tenant@example.com / technician@example.com");
  console.log("   Password ทั้งหมด: Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
