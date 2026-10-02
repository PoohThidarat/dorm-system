import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { calculateLateFee, calculateTotalInvoice, generateInvoiceNumber } from "../src/utils/billing.util";
import { currentBillingMonth, defaultDueDate, diffInDays } from "../src/utils/date.util";

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
        nationalId: `100000000${String(i + 1000).padStart(4, "0")}`,
      },
    });
  }

  // ---- Phase 3: สัญญาเช่า + มิเตอร์น้ำ/ไฟ + ใบแจ้งหนี้ตัวอย่าง (ผู้เช่า 1-10 เข้าอยู่ห้อง 1-10) ----

  const thisMonth = currentBillingMonth();
  const monthOffset = (offset: number) =>
    new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() + offset, 1));
  const twoMonthsAgo = monthOffset(-2);
  const lastMonth = monthOffset(-1);

  for (let i = 1; i <= 10; i++) {
    const room = rooms[i - 1];
    const tenantUserRow = await prisma.user.findUniqueOrThrow({ where: { email: `tenant${i}@example.com` } });
    const tenantRow = await prisma.tenant.findUniqueOrThrow({ where: { userId: tenantUserRow.id } });

    let contract = await prisma.rentalContract.findFirst({ where: { tenantId: tenantRow.id } });
    if (!contract) {
      contract = await prisma.rentalContract.create({
        data: {
          roomId: room.id,
          tenantId: tenantRow.id,
          startDate: monthOffset(-3),
          endDate: monthOffset(9),
          deposit: room.deposit,
          status: "ACTIVE",
        },
      });
      await prisma.room.update({ where: { id: room.id }, data: { status: "OCCUPIED" } });
    }

    // มิเตอร์ + ค่าที่จด 2 เดือนล่าสุด (น้ำ 18 บาท/หน่วย, ไฟ 8 บาท/หน่วย)
    const waterMeter = await prisma.waterMeter.upsert({
      where: { roomId: room.id },
      update: {},
      create: { roomId: room.id, pricePerUnit: 18 },
    });
    const electricityMeter = await prisma.electricityMeter.upsert({
      where: { roomId: room.id },
      update: {},
      create: { roomId: room.id, pricePerUnit: 8 },
    });

    const waterUsage = [10 + i, 8 + (i % 5)];
    const electricityUsage = [100 + i * 3, 110 + i * 2];
    let waterMeterValue = 0;
    let electricityMeterValue = 0;
    const readingMonths = [twoMonthsAgo, lastMonth];

    for (let m = 0; m < 2; m++) {
      await prisma.waterReading.upsert({
        where: { meterId_readingMonth: { meterId: waterMeter.id, readingMonth: readingMonths[m] } },
        update: {},
        create: {
          meterId: waterMeter.id,
          previousMeter: waterMeterValue,
          currentMeter: waterMeterValue + waterUsage[m],
          usage: waterUsage[m],
          total: waterUsage[m] * 18,
          readingMonth: readingMonths[m],
        },
      });
      waterMeterValue += waterUsage[m];

      await prisma.electricityReading.upsert({
        where: { meterId_readingMonth: { meterId: electricityMeter.id, readingMonth: readingMonths[m] } },
        update: {},
        create: {
          meterId: electricityMeter.id,
          previousMeter: electricityMeterValue,
          currentMeter: electricityMeterValue + electricityUsage[m],
          usage: electricityUsage[m],
          total: electricityUsage[m] * 8,
          readingMonth: readingMonths[m],
        },
      });
      electricityMeterValue += electricityUsage[m];
    }

    // ใบแจ้งหนี้: ผู้เช่า 1-2 มีบิลเดือนก่อนหน้าที่ค้างชำระ (OVERDUE + ค่าปรับ), ทุกคนมีบิลเดือนล่าสุด (ISSUED)
    for (let m = 0; m < 2; m++) {
      if (m === 0 && i > 2) continue;
      const billingMonth = readingMonths[m];
      const rent = Number(room.monthlyRent);
      const water = waterUsage[m] * 18;
      const electricity = electricityUsage[m] * 8;
      const base = { rent, water, electricity, otherCharges: 0, discount: 0 };
      const dueDate = defaultDueDate(billingMonth);
      const overdueDays = diffInDays(new Date(), dueDate);
      const isOverdue = m === 0;
      const fine = isOverdue ? calculateLateFee(calculateTotalInvoice({ ...base, fine: 0 }), overdueDays) : 0;

      await prisma.invoice.upsert({
        where: { contractId_billingMonth: { contractId: contract.id, billingMonth } },
        update: {},
        create: {
          invoiceNumber: generateInvoiceNumber(billingMonth, i),
          contractId: contract.id,
          billingMonth,
          ...base,
          fine,
          total: calculateTotalInvoice({ ...base, fine }),
          dueDate,
          status: isOverdue ? "OVERDUE" : "ISSUED",
          items: {
            create: [
              { label: "ค่าเช่าห้อง", amount: rent },
              { label: `ค่าน้ำ (${waterUsage[m]} หน่วย)`, amount: water },
              { label: `ค่าไฟ (${electricityUsage[m]} หน่วย)`, amount: electricity },
            ],
          },
        },
      });
    }
  }

  console.log("✅ Seed สำเร็จ: admin@example.com / tenant@example.com / technician@example.com");
  console.log("   ผู้เช่าตัวอย่างเพิ่มเติม: tenant1@example.com ... tenant15@example.com");
  console.log("   Password ทั้งหมด: Password123!");
  console.log(`   สร้างห้องพักทั้งหมด: ${rooms.length} ห้อง`);
  console.log("   สัญญา/มิเตอร์/ใบแจ้งหนี้ตัวอย่าง: ผู้เช่า 1-10 อยู่ห้อง 1-10 (ผู้เช่า 1-2 มีบิลค้างชำระ)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
