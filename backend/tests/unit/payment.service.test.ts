// Unit Test ของ paymentService: กฎการชำระเงิน (spec ข้อ 11, 40 rule #5-#7) — mock repository ทั้งหมด ไม่ต่อ DB

jest.mock("../../src/services/receipt.service", () => ({ receiptService: { generateAndStore: jest.fn() } }));
jest.mock("../../src/repositories/invoice.repository", () => ({ invoiceRepository: { findById: jest.fn() } }));
jest.mock("../../src/repositories/tenant.repository", () => ({ tenantRepository: { findByUserId: jest.fn() } }));
jest.mock("../../src/repositories/payment.repository", () => ({
  PAYABLE_INVOICE_STATUSES: ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"],
  paymentRepository: {
    findMany: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    findPendingByInvoice: jest.fn(),
    findActiveByReference: jest.fn(),
    sumApproved: jest.fn(),
    reject: jest.fn(),
    approveWithReceipt: jest.fn(),
  },
}));

import { invoiceRepository } from "../../src/repositories/invoice.repository";
import { paymentRepository } from "../../src/repositories/payment.repository";
import { tenantRepository } from "../../src/repositories/tenant.repository";
import { paymentService } from "../../src/services/payment.service";
import { receiptService } from "../../src/services/receipt.service";

const invoices = invoiceRepository as jest.Mocked<typeof invoiceRepository>;
const payments = paymentRepository as jest.Mocked<typeof paymentRepository>;
const tenants = tenantRepository as jest.Mocked<typeof tenantRepository>;
const receipts = receiptService as jest.Mocked<typeof receiptService>;

const invoice = (overrides: Record<string, unknown> = {}) =>
  ({ id: 10, status: "ISSUED", total: 5000, contract: { tenantId: 3 }, ...overrides }) as never;

const submitInput = {
  invoiceId: 10,
  amount: 5000,
  method: "BANK_TRANSFER" as const,
  paymentDate: new Date(),
  referenceNumber: "REF123",
};

describe("paymentService.submit (ผู้เช่าแจ้งชำระ)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    invoices.findById.mockResolvedValue(invoice());
    payments.findPendingByInvoice.mockResolvedValue(null);
    payments.findActiveByReference.mockResolvedValue(null);
    payments.sumApproved.mockResolvedValue(0);
    payments.create.mockImplementation(async (d) => ({ id: 1, status: "PENDING", ...d }) as never);
  });

  it("สร้างรายการ PENDING พร้อมสลิป", async () => {
    const result = await paymentService.submit(20, submitInput, "payment-slips/a.png");
    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 10, amount: 5000, slipPath: "payment-slips/a.png" }),
    );
    expect(result).toMatchObject({ status: "PENDING" });
  });

  it("rule #7: ชำระบิลของผู้เช่าคนอื่นไม่ได้", async () => {
    invoices.findById.mockResolvedValue(invoice({ contract: { tenantId: 99 } }));
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
    expect(payments.create).not.toHaveBeenCalled();
  });

  it("บิล DRAFT ที่ผู้เช่าไม่ควรเห็น -> FORBIDDEN (ไม่เผยว่ามีบิลนี้)", async () => {
    invoices.findById.mockResolvedValue(invoice({ status: "DRAFT" }));
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });

  it("ไม่พบโปรไฟล์ผู้เช่า -> 404", async () => {
    tenants.findByUserId.mockResolvedValue(null);
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({ errorCode: "TENANT_NOT_FOUND" });
  });

  it("บิลที่ชำระครบแล้ว -> INVOICE_ALREADY_PAID", async () => {
    invoices.findById.mockResolvedValue(invoice({ status: "PAID" }));
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({
      errorCode: "INVOICE_ALREADY_PAID",
    });
  });

  it("บิลที่ยกเลิกแล้ว -> INVOICE_NOT_PAYABLE", async () => {
    invoices.findById.mockResolvedValue(invoice({ status: "CANCELLED" }));
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({
      errorCode: "INVOICE_NOT_PAYABLE",
    });
  });

  it("ต้องแนบสลิป", async () => {
    await expect(paymentService.submit(20, submitInput, undefined)).rejects.toMatchObject({ errorCode: "SLIP_REQUIRED" });
  });

  it("มีรายการรอตรวจสอบของบิลนี้อยู่แล้ว -> 409", async () => {
    payments.findPendingByInvoice.mockResolvedValue({ id: 7 } as never);
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({
      errorCode: "PAYMENT_PENDING_EXISTS",
    });
  });

  it("จำนวนเงินเกินยอดคงเหลือ (หักยอดที่อนุมัติแล้ว)", async () => {
    payments.sumApproved.mockResolvedValue(3000);
    await expect(paymentService.submit(20, { ...submitInput, amount: 2500 }, "x.png")).rejects.toMatchObject({
      errorCode: "AMOUNT_EXCEEDS_BALANCE",
    });
  });

  it("จ่ายบางส่วนได้ถ้าไม่เกินยอดคงเหลือ", async () => {
    payments.sumApproved.mockResolvedValue(3000);
    await expect(paymentService.submit(20, { ...submitInput, amount: 2000 }, "x.png")).resolves.toBeDefined();
  });

  it("เลขอ้างอิงการโอนซ้ำ -> DUPLICATE_REFERENCE", async () => {
    payments.findActiveByReference.mockResolvedValue({ id: 5 } as never);
    await expect(paymentService.submit(20, submitInput, "x.png")).rejects.toMatchObject({
      errorCode: "DUPLICATE_REFERENCE",
    });
  });
});

describe("paymentService.recordByAdmin (บันทึกเงินสด)", () => {
  const input = { invoiceId: 10, amount: 5000, method: "CASH" as const, paymentDate: new Date() };

  beforeEach(() => {
    jest.resetAllMocks();
    invoices.findById.mockResolvedValue(invoice());
    payments.findActiveByReference.mockResolvedValue(null);
    payments.sumApproved.mockResolvedValue(0);
    payments.create.mockResolvedValue({ id: 50 } as never);
    payments.approveWithReceipt.mockResolvedValue({ payment: { id: 50 }, receipt: { id: 9 }, invoiceStatus: "PAID" } as never);
    receipts.generateAndStore.mockResolvedValue(Buffer.from("pdf"));
  });

  it("อนุมัติและออกใบเสร็จทันที พร้อมสร้างไฟล์ PDF", async () => {
    const result = await paymentService.recordByAdmin(1, input);
    expect(payments.approveWithReceipt).toHaveBeenCalledWith(50, 1);
    expect(receipts.generateAndStore).toHaveBeenCalledWith(9);
    expect(result.invoiceStatus).toBe("PAID");
  });

  it("เกินยอดคงเหลือ -> ปฏิเสธก่อนสร้างรายการ", async () => {
    await expect(paymentService.recordByAdmin(1, { ...input, amount: 6000 })).rejects.toMatchObject({
      errorCode: "AMOUNT_EXCEEDS_BALANCE",
    });
    expect(payments.create).not.toHaveBeenCalled();
  });

  it("อนุมัติล้มเหลว -> ลบรายการที่เพิ่งสร้าง ไม่ทิ้ง PENDING ค้าง", async () => {
    payments.approveWithReceipt.mockRejectedValue(new Error("boom"));
    await expect(paymentService.recordByAdmin(1, input)).rejects.toThrow("boom");
    expect(payments.delete).toHaveBeenCalledWith(50);
  });
});

describe("paymentService.approve", () => {
  const approved = { payment: { id: 1 }, receipt: { id: 8 }, invoiceStatus: "PAID" } as never;
  beforeEach(() => {
    jest.resetAllMocks();
    payments.findById.mockResolvedValue({ id: 1 } as never);
    receipts.generateAndStore.mockResolvedValue(Buffer.from("pdf"));
  });

  it("ไม่พบรายการ -> 404", async () => {
    payments.findById.mockResolvedValue(null);
    await expect(paymentService.approve(1, 2)).rejects.toMatchObject({ errorCode: "PAYMENT_NOT_FOUND" });
  });

  it("อนุมัติแล้วสร้างไฟล์ใบเสร็จ PDF", async () => {
    payments.approveWithReceipt.mockResolvedValue(approved);
    await paymentService.approve(1, 2);
    expect(payments.approveWithReceipt).toHaveBeenCalledWith(1, 2);
    expect(receipts.generateAndStore).toHaveBeenCalledWith(8);
  });

  it("เลขใบเสร็จชนกัน (P2002) -> ลองใหม่แล้วสำเร็จ", async () => {
    payments.approveWithReceipt
      .mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }))
      .mockResolvedValueOnce(approved);
    await expect(paymentService.approve(1, 2)).resolves.toBeDefined();
    expect(payments.approveWithReceipt).toHaveBeenCalledTimes(2);
  });

  it("ชนกันครบ 3 ครั้ง -> ยอมแพ้และส่ง error ออกไป", async () => {
    payments.approveWithReceipt.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    await expect(paymentService.approve(1, 2)).rejects.toThrow("dup");
    expect(payments.approveWithReceipt).toHaveBeenCalledTimes(3);
  });

  it("error อื่น (เช่น อนุมัติซ้ำ) ไม่ retry", async () => {
    payments.approveWithReceipt.mockRejectedValue(new Error("PAYMENT_NOT_PENDING"));
    await expect(paymentService.approve(1, 2)).rejects.toThrow("PAYMENT_NOT_PENDING");
    expect(payments.approveWithReceipt).toHaveBeenCalledTimes(1);
  });

  it("สร้าง PDF ไม่สำเร็จ ไม่ทำให้การอนุมัติล้มเหลว", async () => {
    payments.approveWithReceipt.mockResolvedValue(approved);
    receipts.generateAndStore.mockRejectedValue(new Error("disk full"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(paymentService.approve(1, 2)).resolves.toBeDefined();
  });
});

describe("paymentService.reject / getByIdForUser", () => {
  beforeEach(() => jest.resetAllMocks());

  it("ปฏิเสธพร้อมเหตุผลและผู้ตรวจสอบ", async () => {
    payments.findById.mockResolvedValue({ id: 1 } as never);
    payments.reject.mockResolvedValue({ id: 1, status: "REJECTED" } as never);
    await paymentService.reject(1, 2, "สลิปไม่ชัด");
    expect(payments.reject).toHaveBeenCalledWith(1, 2, "สลิปไม่ชัด");
  });

  it("Admin ดูรายการของใครก็ได้", async () => {
    payments.findById.mockResolvedValue({ id: 1, invoice: { contract: { tenantId: 99 } } } as never);
    await expect(paymentService.getByIdForUser(1, { userId: 1, role: "ADMIN" })).resolves.toBeDefined();
  });

  it("rule #7: ผู้เช่าดูรายการของคนอื่นไม่ได้", async () => {
    payments.findById.mockResolvedValue({ id: 1, invoice: { contract: { tenantId: 99 } } } as never);
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    await expect(paymentService.getByIdForUser(1, { userId: 20, role: "TENANT" })).rejects.toMatchObject({
      errorCode: "FORBIDDEN",
    });
  });

  it("ผู้เช่าดูรายการของตัวเองได้", async () => {
    payments.findById.mockResolvedValue({ id: 1, invoice: { contract: { tenantId: 3 } } } as never);
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    await expect(paymentService.getByIdForUser(1, { userId: 20, role: "TENANT" })).resolves.toBeDefined();
  });

  it("ไม่มีสลิปแนบ -> SLIP_NOT_FOUND", async () => {
    payments.findById.mockResolvedValue({ id: 1, slips: [], invoice: { contract: { tenantId: 3 } } } as never);
    await expect(paymentService.getSlipFile(1, { userId: 1, role: "ADMIN" })).rejects.toMatchObject({
      errorCode: "SLIP_NOT_FOUND",
    });
  });

  it("path ของสลิปที่พยายามหลุดออกนอกโฟลเดอร์ uploads ถูกปฏิเสธ (path traversal)", async () => {
    payments.findById.mockResolvedValue({
      id: 1,
      slips: [{ filePath: "../../etc/passwd" }],
      invoice: { contract: { tenantId: 3 } },
    } as never);
    await expect(paymentService.getSlipFile(1, { userId: 1, role: "ADMIN" })).rejects.toMatchObject({
      errorCode: "INVALID_FILE_PATH",
    });
  });
});
