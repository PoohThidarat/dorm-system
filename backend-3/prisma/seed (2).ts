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

  // ---- Phase 2: Room Types + 20 ห้อง + 15 ผู้เช่า (spec ข้อ 33) ----

  const roomTypeStandard = await prisma.roomType.upsert({
    where: { name: "ห้องมาตรฐาน" },
    update: {},
    create: { name: "ห้องมาตรฐาน" },
  });
  const roomTypeDeluxe = await prisma.roomType.upsert({
    where: { name: "ห้องดีลักซ์" },
    update: {},
    create: { name: "ห้องดีลักซ์" },
  });

  const rooms = [];
  for (let i = 1; i <= 20; i++) {
    const floor = Math.ceil(i / 5);
    const roomNumber = `${floor}0${i % 5 === 0 ? 5 : i % 5}`;
    const room = await prisma.room.upsert({
      where: { roomNumber },
      update: {},
      create: {
        roomNumber,
        floor,
        roomTypeId: i % 4 === 0 ? roomTypeDeluxe.id : roomTypeStandard.id,
        monthlyRent: i % 4 === 0 ? 5500 : 4000,
        deposit: i % 4 === 0 ? 11000 : 8000,
        status: "AVAILABLE",
      },
    });
    rooms.push(room);
  }

  for (let i = 1; i <= 15; i++) {
    const email = `tenant${i}@example.com`;
    const tenantUserRow = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: demoPasswordHash,
        firstName: `ผู้เช่า`,
        lastName: `${i}`,
        roleId: roles.TENANT.id,
      },
    });

    await prisma.tenant.upsert({
      where: { userId: tenantUserRow.id },
      update: {},
      create: {
        userId: tenantUserRow.id,
        nationalId: `100000000${String(i).padStart(4, "0")}`,
      },
    });
  }

  console.log("✅ Seed สำเร็จ: admin@example.com / tenant@example.com / technician@example.com");
  console.log("   ผู้เช่าตัวอย่างเพิ่มเติม: tenant1@example.com ... tenant15@example.com");
  console.log("   Password ทั้งหมด: Password123!");
  console.log(`   สร้างห้องพักทั้งหมด: ${rooms.length} ห้อง`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
