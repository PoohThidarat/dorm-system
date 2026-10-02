// Unit Test ของ receiptService: สิทธิ์การเข้าถึงใบเสร็จ (rule #7) และ fallback การสร้าง PDF

jest.mock("../../src/config/env", () => ({ env: { receipt: { issuerName: "หอพัก", issuerAddress: "" } } }));
jest.mock("../../src/repositories/tenant.repository", () => ({ tenantRepository: { findByUserId: jest.fn() } }));
jest.mock("../../src/repositories/receipt.repository", () => ({
  receiptRepository: { findMany: jest.fn(), findById: jest.fn(), setPdfPath: jest.fn(), sumApprovedUpTo: jest.fn() },
}));

import { receiptRepository } from "../../src/repositories/receipt.repository";
import { tenantRepository } from "../../src/repositories/tenant.repository";
import { receiptService } from "../../src/services/receipt.service";

const receipts = receiptRepository as jest.Mocked<typeof receiptRepository>;
const tenants = tenantRepository as jest.Mocked<typeof tenantRepository>;
const receiptOf = (tenantId: number, extra: Record<string, unknown> = {}) =>
  ({ id: 1, receiptNumber: "REC-202609-0001", pdfFilePath: null, payment: { invoice: { contract: { tenantId } } }, ...extra }) as never;

describe("receiptService.getByIdForUser", () => {
  beforeEach(() => jest.resetAllMocks());

  it("ไม่พบใบเสร็จ -> 404", async () => {
    receipts.findById.mockResolvedValue(null);
    await expect(receiptService.getByIdForUser(1, { userId: 1, role: "ADMIN" })).rejects.toMatchObject({
      errorCode: "RECEIPT_NOT_FOUND",
    });
  });

  it("Admin ดูได้ทุกใบ", async () => {
    receipts.findById.mockResolvedValue(receiptOf(99));
    await expect(receiptService.getByIdForUser(1, { userId: 1, role: "SUPER_ADMIN" })).resolves.toBeDefined();
  });

  it("ผู้เช่าดูใบเสร็จของตัวเองได้", async () => {
    receipts.findById.mockResolvedValue(receiptOf(3));
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    await expect(receiptService.getByIdForUser(1, { userId: 20, role: "TENANT" })).resolves.toBeDefined();
  });

  it("rule #7: ผู้เช่าดูใบเสร็จของคนอื่นไม่ได้", async () => {
    receipts.findById.mockResolvedValue(receiptOf(99));
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    await expect(receiptService.getByIdForUser(1, { userId: 20, role: "TENANT" })).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });
});

describe("receiptService.getPdf", () => {
  beforeEach(() => jest.resetAllMocks());

  it("ยังไม่มีไฟล์ PDF -> สร้างให้ตอนดาวน์โหลด (fallback)", async () => {
    receipts.findById.mockResolvedValue(receiptOf(3));
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    const spy = jest.spyOn(receiptService, "generateAndStore").mockResolvedValue(Buffer.from("%PDF-fake"));

    const result = await receiptService.getPdf(1, { userId: 20, role: "TENANT" });
    expect(spy).toHaveBeenCalledWith(1);
    expect(result.filename).toBe("REC-202609-0001.pdf");
    spy.mockRestore();
  });

  it("path ของ PDF ที่หลุดออกนอกโฟลเดอร์ uploads ไม่ถูกอ่าน -> สร้างใหม่แทน", async () => {
    receipts.findById.mockResolvedValue(receiptOf(3, { pdfFilePath: "../../etc/passwd" }));
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    const spy = jest.spyOn(receiptService, "generateAndStore").mockResolvedValue(Buffer.from("%PDF-fake"));

    await receiptService.getPdf(1, { userId: 20, role: "TENANT" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ผู้เช่าคนอื่นขอ PDF ไม่ได้", async () => {
    receipts.findById.mockResolvedValue(receiptOf(99));
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    await expect(receiptService.getPdf(1, { userId: 20, role: "TENANT" })).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });
});
