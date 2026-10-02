import fs from "fs/promises";
import path from "path";
import { UPLOAD_ROOT } from "../middlewares/upload.middleware";
import { invoiceRepository } from "../repositories/invoice.repository";
import { PAYABLE_INVOICE_STATUSES, PaymentFilters, paymentRepository } from "../repositories/payment.repository";
import { tenantRepository } from "../repositories/tenant.repository";
import { ApiError } from "../utils/apiResponse";
import { calculateRemainingBalance, exceedsBalance } from "../utils/billing.util";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { RecordPaymentInput, SubmitPaymentInput } from "../validators/payment.validator";
import { AuthUser, receiptService } from "./receipt.service";

// หน้าที่ของไฟล์: Business logic ของการชำระเงิน (spec ข้อ 11, 40)
//   ผู้เช่าแจ้งชำระ + แนบสลิป -> PENDING -> Admin อนุมัติ/ปฏิเสธ
//   rule #5  Payment ที่ APPROVED แล้วแก้จำนวนเงินไม่ได้ (ไม่มี endpoint แก้ไข)
//   rule #6  Receipt สร้างจาก Payment ที่ APPROVED เท่านั้น (สร้างใน transaction เดียวกับการอนุมัติ)
//   rule #7  ผู้เช่าเห็น/แจ้งชำระได้เฉพาะบิลของตัวเอง

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];
const MAX_RECEIPT_NUMBER_RETRIES = 3;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

async function loadPayableInvoice(invoiceId: number) {
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) throw new ApiError(404, "INVOICE_NOT_FOUND", "ไม่พบใบแจ้งหนี้นี้");
  if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
    const message =
      invoice.status === "PAID"
        ? "บิลนี้ชำระครบแล้ว"
        : `บิลสถานะ ${invoice.status} ไม่สามารถรับชำระได้`;
    throw new ApiError(409, invoice.status === "PAID" ? "INVOICE_ALREADY_PAID" : "INVOICE_NOT_PAYABLE", message);
  }
  return invoice;
}

async function assertAmountWithinBalance(invoiceId: number, invoiceTotal: number, amount: number) {
  const paid = await paymentRepository.sumApproved(invoiceId);
  const remaining = calculateRemainingBalance(invoiceTotal, paid);
  if (exceedsBalance(amount, remaining)) {
    throw new ApiError(400, "AMOUNT_EXCEEDS_BALANCE", `จำนวนเงินเกินยอดคงเหลือของบิล (คงเหลือ ${remaining.toFixed(2)} บาท)`);
  }
}

async function assertReferenceUnused(referenceNumber?: string) {
  if (!referenceNumber) return;
  if (await paymentRepository.findActiveByReference(referenceNumber)) {
    throw new ApiError(409, "DUPLICATE_REFERENCE", "เลขอ้างอิงการโอนนี้ถูกใช้แจ้งชำระไปแล้ว");
  }
}

// อนุมัติ + ออกใบเสร็จ; ถ้าเลขใบเสร็จชนกันจากการอนุมัติพร้อมกัน (unique violation) ให้ลองใหม่
async function approveWithRetry(paymentId: number, reviewerId: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RECEIPT_NUMBER_RETRIES; attempt++) {
    try {
      return await paymentRepository.approveWithReceipt(paymentId, reviewerId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

// สร้างไฟล์ PDF ใบเสร็จแบบ best-effort: ถ้าล้มเหลวการอนุมัติยังสำเร็จ (ระบบจะสร้างใหม่ตอนดาวน์โหลด)
async function storeReceiptPdfSafely(receiptId: number) {
  try {
    await receiptService.generateAndStore(receiptId);
  } catch (err) {
    console.error(`[receipt] สร้าง PDF ใบเสร็จ #${receiptId} ไม่สำเร็จ (จะสร้างใหม่เมื่อดาวน์โหลด)`, err);
  }
}

export const paymentService = {
  async list(query: ListQuery, filters: PaymentFilters) {
    const { items, total } = await paymentRepository.findMany(query, filters);
    return paginatedResult(items, total, query);
  },

  async listForTenantUser(userId: number, query: ListQuery, filters: PaymentFilters) {
    const tenant = await tenantRepository.findByUserId(userId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบข้อมูลผู้เช่า");
    const { items, total } = await paymentRepository.findMany(query, { ...filters, tenantId: tenant.id });
    return paginatedResult(items, total, query);
  },

  async getByIdForUser(id: number, user: AuthUser) {
    const payment = await paymentRepository.findById(id);
    if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "ไม่พบรายการชำระเงินนี้");
    if (!ADMIN_ROLES.includes(user.role)) {
      const tenant = await tenantRepository.findByUserId(user.userId);
      if (!tenant || payment.invoice.contract.tenantId !== tenant.id) {
        throw new ApiError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }
    }
    return payment;
  },

  // ผู้เช่าแจ้งชำระเงิน + แนบสลิป (slipPath = path สัมพันธ์ใต้ uploads/)
  async submit(userId: number, input: SubmitPaymentInput, slipPath?: string) {
    const tenant = await tenantRepository.findByUserId(userId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบข้อมูลผู้เช่า");

    const invoice = await invoiceRepository.findById(input.invoiceId);
    // บิลของคนอื่น หรือบิลร่างที่ผู้เช่าไม่ควรเห็น -> ปฏิเสธเหมือนกัน (ไม่บอกว่ามีบิลนี้อยู่หรือไม่)
    if (!invoice || invoice.contract.tenantId !== tenant.id || invoice.status === "DRAFT") {
      throw new ApiError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
    }
    await loadPayableInvoice(invoice.id);

    if (!slipPath) {
      throw new ApiError(400, "SLIP_REQUIRED", "กรุณาแนบสลิปการโอนเงิน");
    }
    if (await paymentRepository.findPendingByInvoice(invoice.id)) {
      throw new ApiError(409, "PAYMENT_PENDING_EXISTS", "บิลนี้มีรายการแจ้งชำระที่รอตรวจสอบอยู่แล้ว");
    }
    await assertAmountWithinBalance(invoice.id, Number(invoice.total), input.amount);
    await assertReferenceUnused(input.referenceNumber);

    return paymentRepository.create({
      invoiceId: invoice.id,
      amount: input.amount,
      method: input.method,
      paymentDate: input.paymentDate,
      referenceNumber: input.referenceNumber,
      slipPath,
    });
  },

  // Admin บันทึกการรับชำระเอง (เช่น เงินสดหน้าเคาน์เตอร์) — อนุมัติและออกใบเสร็จทันที
  async recordByAdmin(adminId: number, input: RecordPaymentInput) {
    const invoice = await loadPayableInvoice(input.invoiceId);
    await assertAmountWithinBalance(invoice.id, Number(invoice.total), input.amount);
    await assertReferenceUnused(input.referenceNumber);

    const created = await paymentRepository.create({
      invoiceId: invoice.id,
      amount: input.amount,
      method: input.method,
      paymentDate: input.paymentDate,
      referenceNumber: input.referenceNumber,
    });

    try {
      const result = await approveWithRetry(created.id, adminId);
      await storeReceiptPdfSafely(result.receipt.id);
      return result;
    } catch (err) {
      await paymentRepository.delete(created.id); // ไม่ทิ้งรายการ PENDING ค้างจากการบันทึกที่ล้มเหลว
      throw err;
    }
  },

  async approve(id: number, reviewerId: number) {
    const existing = await paymentRepository.findById(id);
    if (!existing) throw new ApiError(404, "PAYMENT_NOT_FOUND", "ไม่พบรายการชำระเงินนี้");

    const result = await approveWithRetry(id, reviewerId);
    await storeReceiptPdfSafely(result.receipt.id);
    return result;
  },

  async reject(id: number, reviewerId: number, reason: string) {
    const existing = await paymentRepository.findById(id);
    if (!existing) throw new ApiError(404, "PAYMENT_NOT_FOUND", "ไม่พบรายการชำระเงินนี้");
    return paymentRepository.reject(id, reviewerId, reason);
  },

  // คืน path เต็มของไฟล์สลิป หลังตรวจสิทธิ์ (สลิปไม่เสิร์ฟแบบสาธารณะ)
  async getSlipFile(id: number, user: AuthUser): Promise<string> {
    const payment = await this.getByIdForUser(id, user);
    const slip = payment.slips[0];
    if (!slip) throw new ApiError(404, "SLIP_NOT_FOUND", "รายการนี้ไม่มีสลิปแนบ");

    const root = path.resolve(UPLOAD_ROOT);
    const absolute = path.resolve(root, slip.filePath);
    if (!absolute.startsWith(root + path.sep)) {
      throw new ApiError(400, "INVALID_FILE_PATH", "ตำแหน่งไฟล์ไม่ถูกต้อง");
    }
    try {
      await fs.access(absolute);
    } catch {
      throw new ApiError(404, "SLIP_NOT_FOUND", "ไม่พบไฟล์สลิป");
    }
    return absolute;
  },
};
