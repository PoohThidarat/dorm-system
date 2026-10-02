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

  jwt: {
    accessSecret: required("JWT_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  },
};
