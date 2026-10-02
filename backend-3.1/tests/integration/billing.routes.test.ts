import request from "supertest";
import jwt from "jsonwebtoken";

// API Test + Security Test ของ route ใบแจ้งหนี้/มิเตอร์ (spec ข้อ 31)
// ทดสอบ "ด่าน" authenticate + RBAC + validation จริงผ่าน Express app
// mock เฉพาะ config/prisma และ invoice/meter service เพื่อไม่ต้องต่อ DB

jest.mock("../../src/config/env", () => ({
  env: {
    nodeEnv: "test",
    port: 0,
    corsOrigin: "http://localhost:3000",
    jwt: { accessSecret: "test-access", accessExpiresIn: "15m", refreshSecret: "test-refresh", refreshExpiresIn: "7d" },
    billing: { defaultWaterPrice: 18, defaultElectricityPrice: 8, schedulerEnabled: false },
  },
}));
jest.mock("../../src/config/prisma", () => ({ prisma: {} }));
jest.mock("../../src/services/invoice.service", () => ({
  invoiceService: {
    list: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    listForTenantUser: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    getById: jest.fn().mockResolvedValue({ id: 5 }),
    getByIdForTenantUser: jest.fn().mockResolvedValue({ id: 5 }),
    generateMonthly: jest.fn().mockResolvedValue({ createdCount: 0 }),
    previousMonth: () => new Date(Date.UTC(2026, 7, 1)),
  },
}));
jest.mock("../../src/services/meter.service", () => ({
  meterService: {
    recordReading: jest.fn().mockResolvedValue({ id: 1 }),
    history: jest.fn().mockResolvedValue({ items: [] }),
    historyForTenantUser: jest.fn().mockResolvedValue({ items: [] }),
  },
}));

import { createApp } from "../../src/app";
import { invoiceService } from "../../src/services/invoice.service";

const app = createApp();
const tokenFor = (role: string, userId = 1) => jwt.sign({ userId, role }, "test-access", { expiresIn: "15m" });
const bearer = (role: string, userId?: number) => ({ Authorization: `Bearer ${tokenFor(role, userId)}` });

describe("Auth & RBAC ของ /api/invoices", () => {
  it("ไม่มี token -> 401", async () => {
    const res = await request(app).get("/api/invoices");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, errorCode: "UNAUTHENTICATED" });
  });

  it("token ปลอม -> 401", async () => {
    const res = await request(app).get("/api/invoices").set("Authorization", "Bearer fake.token.value");
    expect(res.status).toBe(401);
  });

  it.each(["TENANT", "TECHNICIAN"])("%s ดูรายการบิลทั้งหมดของ Admin ไม่ได้ -> 403", async (role) => {
    const res = await request(app).get("/api/invoices").set(bearer(role));
    expect(res.status).toBe(403);
  });

  it.each(["TENANT", "TECHNICIAN"])("%s ออกบิลรายเดือน / สร้างบิลไม่ได้ -> 403", async (role) => {
    expect((await request(app).post("/api/invoices/generate-monthly").set(bearer(role))).status).toBe(403);
    expect((await request(app).post("/api/invoices").set(bearer(role)).send({})).status).toBe(403);
  });

  it("ADMIN ดูรายการบิลได้ -> 200", async () => {
    const res = await request(app).get("/api/invoices").set(bearer("ADMIN"));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("ADMIN เรียก /my ไม่ได้ (เฉพาะ Tenant) -> 403", async () => {
    const res = await request(app).get("/api/invoices/my").set(bearer("ADMIN"));
    expect(res.status).toBe(403);
  });

  it("TECHNICIAN ดูบิลรายใบไม่ได้ -> 403", async () => {
    const res = await request(app).get("/api/invoices/5").set(bearer("TECHNICIAN"));
    expect(res.status).toBe(403);
  });
});

describe("Tenant เห็นเฉพาะข้อมูลของตัวเอง (rule #7)", () => {
  it("TENANT เรียกดูบิลรายใบ -> ผ่านการตรวจความเป็นเจ้าของด้วย userId ของตัวเองเสมอ", async () => {
    const res = await request(app).get("/api/invoices/5").set(bearer("TENANT", 42));
    expect(res.status).toBe(200);
    expect(invoiceService.getByIdForTenantUser).toHaveBeenCalledWith(5, 42);
    expect(invoiceService.getById).not.toHaveBeenCalled();
  });

  it("ADMIN ดูบิลรายใบ -> ไม่ผ่านการตรวจความเป็นเจ้าของ", async () => {
    await request(app).get("/api/invoices/5").set(bearer("ADMIN", 1));
    expect(invoiceService.getById).toHaveBeenCalledWith(5);
  });

  it("TENANT ดูรายการบิลของตัวเองผ่าน /my ได้ โดยใช้ userId จาก token (ไม่รับจาก query)", async () => {
    const res = await request(app).get("/api/invoices/my?tenantId=999").set(bearer("TENANT", 7));
    expect(res.status).toBe(200);
    expect((invoiceService.listForTenantUser as jest.Mock).mock.calls[0][0]).toBe(7);
  });
});

describe("Auth & validation ของ /api/meters", () => {
  it("TENANT จดมิเตอร์ไม่ได้ -> 403", async () => {
    const res = await request(app)
      .post("/api/meters/water/readings")
      .set(bearer("TENANT"))
      .send({ roomId: 1, readingMonth: "2026-09", currentMeter: 10 });
    expect(res.status).toBe(403);
  });

  it("ADMIN เรียกประวัติของ Tenant (/my) ไม่ได้ -> 403", async () => {
    const res = await request(app).get("/api/meters/my/water/readings").set(bearer("ADMIN"));
    expect(res.status).toBe(403);
  });

  it("TENANT ดูประวัติมิเตอร์ของตัวเองได้ -> 200", async () => {
    const res = await request(app).get("/api/meters/my/electricity/readings").set(bearer("TENANT"));
    expect(res.status).toBe(200);
  });

  it("ชนิดมิเตอร์ที่ไม่รองรับ -> 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/meters/gas/readings")
      .set(bearer("ADMIN"))
      .send({ roomId: 1, readingMonth: "2026-09", currentMeter: 10 });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("ค่ามิเตอร์ติดลบ / เดือนผิดรูปแบบ -> 400", async () => {
    const negative = await request(app)
      .post("/api/meters/water/readings")
      .set(bearer("ADMIN"))
      .send({ roomId: 1, readingMonth: "2026-09", currentMeter: -5 });
    expect(negative.status).toBe(400);

    const badMonth = await request(app)
      .post("/api/meters/water/readings")
      .set(bearer("ADMIN"))
      .send({ roomId: 1, readingMonth: "09/2026", currentMeter: 5 });
    expect(badMonth.status).toBe(400);
  });

  it("ข้อมูลถูกต้อง -> 201", async () => {
    const res = await request(app)
      .post("/api/meters/water/readings")
      .set(bearer("ADMIN"))
      .send({ roomId: 1, readingMonth: "2026-09", currentMeter: 125 });
    expect(res.status).toBe(201);
  });
});
