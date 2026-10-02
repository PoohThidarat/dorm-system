import { PrismaClient } from "@prisma/client";

// หน้าที่ของไฟล์: สร้าง Prisma Client instance เดียว (singleton) ใช้ทั่วทั้งแอป
// เพื่อป้องกันการเปิด connection pool ซ้ำซ้อนตอน hot-reload ใน dev
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
