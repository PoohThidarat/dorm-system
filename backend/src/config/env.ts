import dotenv from "dotenv";

dotenv.config();

// หน้าที่ของไฟล์: อ่านและตรวจสอบ Environment Variables ที่จำเป็นตั้งแต่ตอน start server
// ถ้าค่าที่จำเป็นหายไป ให้ throw error ทันทีแทนที่จะปล่อยให้พังตอน runtime
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",

  // ราคาต่อหน่วยเริ่มต้นตอนสร้างมิเตอร์ใหม่ (บาท/หน่วย) ปรับรายห้องได้ภายหลัง
  billing: {
    defaultWaterPrice: Number(process.env.WATER_PRICE_PER_UNIT ?? 18),
    defaultElectricityPrice: Number(process.env.ELECTRICITY_PRICE_PER_UNIT ?? 8),
    schedulerEnabled: process.env.BILLING_SCHEDULER_ENABLED !== "false",
  },

  // ข้อมูลผู้ออกใบเสร็จ (แสดงบนหัวใบเสร็จ PDF)
  receipt: {
    issuerName: process.env.RECEIPT_ISSUER_NAME ?? "หอพัก",
    issuerAddress: process.env.RECEIPT_ISSUER_ADDRESS ?? "",
  },

  jwt: {
    accessSecret: required("JWT_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
};
