import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

// หน้าที่ของไฟล์: สร้างและประกอบ Express App (middlewares + routes + error handler)
// แยกจาก server.ts เพื่อให้ Supertest ใน API Test เรียก app ได้โดยไม่ต้อง listen port จริง

export function createApp() {
  const app = express();

  app.use(helmet()); // ป้องกัน header-based attacks พื้นฐาน + ช่วยลด XSS
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  // Rate limiting ป้องกัน brute-force ที่ /api/auth/* (spec ข้อ 24)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง", errorCode: "RATE_LIMITED" },
  });
  app.use("/api/auth", authLimiter);

  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));

  // เสิร์ฟไฟล์ที่อัปโหลด (Contract PDF, Payment Slip, Maintenance Images) แบบ static
  // Phase หลังอาจเปลี่ยนเป็น pre-signed URL จาก cloud storage แทน
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
