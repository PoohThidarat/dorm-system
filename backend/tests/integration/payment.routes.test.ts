import fs from "fs";
import path from "path";
import request from "supertest";
import jwt from "jsonwebtoken";

// API Test + Security Test ของ /api/payments และ /api/receipts (spec ข้อ 31)
// รัน middleware จริงทั้งหมด (authenticate, RBAC, multer, validation, error handler) และ mock เฉพาะ service/DB

jest.mock("../../src/config/env", () => ({
  env: {
    nodeEnv: "test",
    port: 0,
    corsOrigin: "http://localhost:3000",
    jwt: { accessSecret: "test-access", accessExpiresIn: "15m", refreshSecret: "test-refresh", refreshExpiresIn: "7d" },
    billing: { defaultWaterPrice: 18, defaultElectricityPrice: 8, schedulerEnabled: false },
    receipt: { issuerName: "หอพัก", issuerAddress: "" },
  },
}));
jest.mock("../../src/config/prisma", () => ({ prisma: {} }));
jest.mock("../../src/services/payment.service", () => ({
  paymentService: {
    list: jest.fn().mockResolvedValue({ items: [] }),
    listForTenantUser: jest.fn().mockResolvedValue({ items: [] }),
    getByIdForUser: jest.fn().mockResolvedValue({ id: 3 }),
    submit: jest.fn().mockResolvedValue({ id: 3, status: "PENDING" }),
    recordByAdmin: jest.fn().mockResolvedValue({ invoiceStatus: "PAID" }),
    approve: jest.fn().mockResolvedValue({ invoiceStatus: "PAID" }),
    reject: jest.fn().mockResolvedValue({ status: "REJECTED" }),
    getSlipFile: jest.fn(),
  },
}));
jest.mock("../../src/services/receipt.service", () => ({
  receiptService: {
    list: jest.fn().mockResolvedValue({ items: [] }),
    listForTenantUser: jest.fn().mockResolvedValue({ items: [] }),
    getByIdForUser: jest.fn().mockResolvedValue({ id: 5 }),
    getPdf: jest.fn().mockResolvedValue({ buffer: Buffer.from("%PDF-1.4 fake"), filename: "REC-202609-0001.pdf" }),
  },
}));

import { createApp } from "../../src/app";
import { paymentService } from "../../src/services/payment.service";

const app = createApp();
const bearer = (role: string, userId = 1) => ({
  Authorization: `Bearer ${jwt.sign({ userId, role }, "test-access", { expiresIn: "15m" })}`,
});
const UPLOADS = path.join(process.cwd(), "uploads");
const validForm = { invoiceId: "10", amount: "5000", method: "BANK_TRANSFER", referenceNumber: "REF1" };
const png = Buffer.from("89504e470d0a1a0a", "hex");

afterEach(() => jest.clearAllMocks());
afterAll(() => {
  // เก็บกวาดไฟล์ที่ test สร้างในโฟลเดอร์ uploads
  for (const dir of ["payment-slips", "receipts", "contracts"]) {
    fs.rmSync(path.join(UPLOADS, dir), { recursive: true, force: true });
  }
  try {
    fs.rmdirSync(UPLOADS);
  } catch {
    /* ไม่ว่าง/ไม่มี ก็ข้าม */
  }
});

describe("RBAC ของ /api/payments", () => {
  it("ไม่มี token -> 401", async () => {
    expect((await request(app).get("/api/payments")).status).toBe(401);
    expect((await request(app).post("/api/payments")).status).toBe(401);
  });

  it.each(["TENANT", "TECHNICIAN"])("%s ดูรายการชำระทั้งหมด / อนุมัติ / ปฏิเสธ / บันทึกเงินสด ไม่ได้ -> 403", async (role) => {
    expect((await request(app).get("/api/payments").set(bearer(role))).status).toBe(403);
    expect((await request(app).post("/api/payments/3/approve").set(bearer(role))).status).toBe(403);
    expect((await request(app).post("/api/payments/3/reject").set(bearer(role)).send({ reason: "xxx" })).status).toBe(403);
    expect((await request(app).post("/api/payments/record").set(bearer(role)).send({})).status).toBe(403);
    expect(paymentService.approve).not.toHaveBeenCalled();
  });

  it("ADMIN แจ้งชำระแทนผู้เช่าผ่าน endpoint ของผู้เช่าไม่ได้ / เรียก /my ไม่ได้ -> 403", async () => {
    expect((await request(app).post("/api/payments").set(bearer("ADMIN"))).status).toBe(403);
    expect((await request(app).get("/api/payments/my").set(bearer("ADMIN"))).status).toBe(403);
  });

  it("TECHNICIAN ดูรายการ/สลิปรายใบไม่ได้ -> 403", async () => {
    expect((await request(app).get("/api/payments/3").set(bearer("TECHNICIAN"))).status).toBe(403);
    expect((await request(app).get("/api/payments/3/slip").set(bearer("TECHNICIAN"))).status).toBe(403);
  });

  it("ADMIN อนุมัติ -> เรียก service ด้วย id ของรายการและ userId ของผู้อนุมัติจาก token", async () => {
    const res = await request(app).post("/api/payments/3/approve").set(bearer("ADMIN", 42));
    expect(res.status).toBe(200);
    expect(paymentService.approve).toHaveBeenCalledWith(3, 42);
  });

  it("ปฏิเสธต้องมีเหตุผล -> 400 ถ้าไม่ส่ง / สั้นเกินไป", async () => {
    const empty = await request(app).post("/api/payments/3/reject").set(bearer("ADMIN")).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.errorCode).toBe("VALIDATION_ERROR");
    expect((await request(app).post("/api/payments/3/reject").set(bearer("ADMIN")).send({ reason: "ก" })).status).toBe(400);
    expect(paymentService.reject).not.toHaveBeenCalled();
  });

  it("ปฏิเสธพร้อมเหตุผล -> 200", async () => {
    const res = await request(app).post("/api/payments/3/reject").set(bearer("ADMIN", 9)).send({ reason: "สลิปไม่ชัดเจน" });
    expect(res.status).toBe(200);
    expect(paymentService.reject).toHaveBeenCalledWith(3, 9, "สลิปไม่ชัดเจน");
  });

  it("บันทึกเงินสด: จำนวนเงินติดลบ/เป็นศูนย์ -> 400, วิธีชำระ ONLINE ไม่รองรับ -> 400", async () => {
    const base = { invoiceId: 1, method: "CASH" };
    expect((await request(app).post("/api/payments/record").set(bearer("ADMIN")).send({ ...base, amount: -5 })).status).toBe(400);
    expect((await request(app).post("/api/payments/record").set(bearer("ADMIN")).send({ ...base, amount: 0 })).status).toBe(400);
    expect((await request(app).post("/api/payments/record").set(bearer("ADMIN")).send({ invoiceId: 1, amount: 5, method: "ONLINE" })).status).toBe(400);
  });

  it("บันทึกเงินสดถูกต้อง -> 201", async () => {
    const res = await request(app).post("/api/payments/record").set(bearer("ADMIN", 4)).send({ invoiceId: 1, amount: 1000, method: "CASH" });
    expect(res.status).toBe(201);
    expect(paymentService.recordByAdmin).toHaveBeenCalledWith(4, expect.objectContaining({ invoiceId: 1, amount: 1000 }));
  });
});

describe("ผู้เช่าแจ้งชำระ + อัปโหลดสลิป (multipart)", () => {
  it("แจ้งชำระถูกต้อง -> 201 และส่ง path สลิปแบบสัมพันธ์กับ uploads/ ให้ service", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set(bearer("TENANT", 20))
      .field(validForm)
      .attach("slip", png, "slip.png");

    expect(res.status).toBe(201);
    const [userId, input, slipPath] = (paymentService.submit as jest.Mock).mock.calls[0];
    expect(userId).toBe(20);
    expect(input).toMatchObject({ invoiceId: 10, amount: 5000, method: "BANK_TRANSFER" });
    expect(slipPath).toMatch(/^payment-slips\/[\w-]+\.png$/);
  });

  it("วิธีชำระเป็นเงินสด/ONLINE ผู้เช่าเลือกเองไม่ได้ -> 400 และลบไฟล์ที่อัปโหลดทิ้ง", async () => {
    const before = fs.existsSync(path.join(UPLOADS, "payment-slips"))
      ? fs.readdirSync(path.join(UPLOADS, "payment-slips")).length
      : 0;
    const res = await request(app)
      .post("/api/payments")
      .set(bearer("TENANT"))
      .field({ ...validForm, method: "CASH" })
      .attach("slip", png, "slip.png");

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_ERROR");
    const after = fs.readdirSync(path.join(UPLOADS, "payment-slips")).length;
    expect(after).toBe(before); // ไฟล์กำพร้าถูกลบแล้ว
    expect(paymentService.submit).not.toHaveBeenCalled();
  });

  it("จำนวนเงินไม่ใช่ตัวเลข / ติดลบ -> 400", async () => {
    expect((await request(app).post("/api/payments").set(bearer("TENANT")).field({ ...validForm, amount: "abc" })).status).toBe(400);
    expect((await request(app).post("/api/payments").set(bearer("TENANT")).field({ ...validForm, amount: "-10" })).status).toBe(400);
  });

  it("วันที่ชำระอยู่ในอนาคต -> 400", async () => {
    const res = await request(app).post("/api/payments").set(bearer("TENANT")).field({ ...validForm, paymentDate: "2099-01-01" });
    expect(res.status).toBe(400);
  });

  it("ไฟล์ผิดประเภท (.exe) -> 400 INVALID_FILE_TYPE", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set(bearer("TENANT"))
      .field(validForm)
      .attach("slip", Buffer.from("MZ"), "virus.exe");
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("INVALID_FILE_TYPE");
  });

  it("ไฟล์ใหญ่เกิน 5MB -> 400 LIMIT_FILE_SIZE (ไม่ใช่ 500)", async () => {
    const res = await request(app)
      .post("/api/payments")
      .set(bearer("TENANT"))
      .field(validForm)
      .attach("slip", Buffer.alloc(6 * 1024 * 1024, 1), "big.png");
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("LIMIT_FILE_SIZE");
  });
});

describe("สลิปโอนเงินต้องไม่เข้าถึงได้แบบสาธารณะ", () => {
  it("GET /uploads/payment-slips/* และ /uploads/receipts/* -> 404 แม้ไฟล์มีอยู่จริง แต่ไฟล์โฟลเดอร์อื่นยังเสิร์ฟได้", async () => {
    fs.mkdirSync(path.join(UPLOADS, "payment-slips"), { recursive: true });
    fs.mkdirSync(path.join(UPLOADS, "receipts"), { recursive: true });
    fs.mkdirSync(path.join(UPLOADS, "contracts"), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS, "payment-slips", "secret.png"), png);
    fs.writeFileSync(path.join(UPLOADS, "receipts", "REC-202609-0001.pdf"), "%PDF");
    fs.writeFileSync(path.join(UPLOADS, "contracts", "ok.txt"), "public");

    expect((await request(app).get("/uploads/payment-slips/secret.png")).status).toBe(404);
    expect((await request(app).get("/uploads/receipts/REC-202609-0001.pdf")).status).toBe(404);
    expect((await request(app).get("/uploads/contracts/ok.txt")).status).toBe(200); // พิสูจน์ว่า static ยังทำงานปกติ
  });

  it("Admin ดึงสลิปผ่าน endpoint ที่ตรวจสิทธิ์ได้ (ไม่แคช)", async () => {
    const file = path.join(UPLOADS, "payment-slips", "secret.png");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, png);
    (paymentService.getSlipFile as jest.Mock).mockResolvedValue(file);

    const res = await request(app).get("/api/payments/3/slip").set(bearer("ADMIN"));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["content-type"]).toContain("image/png");
  });
});

describe("Tenant เห็นเฉพาะข้อมูลของตัวเอง (rule #7)", () => {
  it("รายการชำระของผู้เช่า ใช้ userId จาก token เสมอ ไม่รับจาก query", async () => {
    const res = await request(app).get("/api/payments/my?tenantId=999&userId=999").set(bearer("TENANT", 7));
    expect(res.status).toBe(200);
    expect((paymentService.listForTenantUser as jest.Mock).mock.calls[0][0]).toBe(7);
  });

  it("ดูรายการรายใบ -> ส่ง user (id+role) จาก token ให้ service ตรวจความเป็นเจ้าของ", async () => {
    await request(app).get("/api/payments/3").set(bearer("TENANT", 7));
    expect(paymentService.getByIdForUser).toHaveBeenCalledWith(3, expect.objectContaining({ userId: 7, role: "TENANT" }));
  });
});

describe("/api/receipts", () => {
  it("ไม่มี token -> 401", async () => {
    expect((await request(app).get("/api/receipts/5/pdf")).status).toBe(401);
  });

  it.each(["TENANT", "TECHNICIAN"])("%s ดูรายการใบเสร็จทั้งหมดของ Admin ไม่ได้ -> 403", async (role) => {
    expect((await request(app).get("/api/receipts").set(bearer(role))).status).toBe(403);
  });

  it("ADMIN เรียก /my ไม่ได้, TECHNICIAN ขอ PDF ไม่ได้ -> 403", async () => {
    expect((await request(app).get("/api/receipts/my").set(bearer("ADMIN"))).status).toBe(403);
    expect((await request(app).get("/api/receipts/5/pdf").set(bearer("TECHNICIAN"))).status).toBe(403);
  });

  it("ผู้เช่าขอ PDF -> เปิดดูในเบราว์เซอร์ (inline) ตามค่าเริ่มต้น", async () => {
    const res = await request(app).get("/api/receipts/5/pdf").set(bearer("TENANT", 7));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("inline");
    expect(res.headers["cache-control"]).toBe("private, no-store");
  });

  it("?download=1 -> บังคับดาวน์โหลดเป็น attachment พร้อมชื่อไฟล์เลขที่ใบเสร็จ", async () => {
    const res = await request(app).get("/api/receipts/5/pdf?download=1").set(bearer("ADMIN"));
    expect(res.headers["content-disposition"]).toContain('attachment; filename="REC-202609-0001.pdf"');
  });
});
