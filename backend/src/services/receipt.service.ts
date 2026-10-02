import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { UPLOAD_ROOT } from "../middlewares/upload.middleware";
import { receiptRepository } from "../repositories/receipt.repository";
import { tenantRepository } from "../repositories/tenant.repository";
import { ApiError } from "../utils/apiResponse";
import { calculateRemainingBalance } from "../utils/billing.util";
import { formatDateBangkok, formatDateUTC } from "../utils/date.util";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { renderReceiptPdf } from "./receipt-pdf.service";

// หน้าที่ของไฟล์: Business logic ของใบเสร็จ (spec ข้อ 12, กฎ #6, #7)
// ใบเสร็จ PDF ถูกสร้างและเก็บเป็นไฟล์ "ตอนอนุมัติการชำระ" เพื่อให้เนื้อหาคงที่ย้อนหลัง
// (บิลที่จ่ายบางส่วนอาจมีค่าปรับเพิ่มทีหลัง ถ้าสร้างสดทุกครั้งเอกสารเดิมจะเปลี่ยนตามไปด้วย)
// ถ้าไฟล์หาย/ยังไม่เคยสร้าง จะสร้างใหม่ให้อัตโนมัติตอนดาวน์โหลด

export interface AuthUser {
  userId: number;
  role: string;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: "เงินสด",
  BANK_TRANSFER: "โอนผ่านธนาคาร",
  QR_PAYMENT: "QR Payment",
  ONLINE: "ชำระออนไลน์",
};

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

export const receiptService = {
  async list(query: ListQuery) {
    const { items, total } = await receiptRepository.findMany(query, {});
    return paginatedResult(items, total, query);
  },

  async listForTenantUser(userId: number, query: ListQuery) {
    const tenant = await tenantRepository.findByUserId(userId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบข้อมูลผู้เช่า");
    const { items, total } = await receiptRepository.findMany(query, { tenantId: tenant.id });
    return paginatedResult(items, total, query);
  },

  // Admin เห็นทุกใบ, Tenant เห็นเฉพาะใบเสร็จของตัวเอง (rule #7)
  async getByIdForUser(id: number, user: AuthUser) {
    const receipt = await receiptRepository.findById(id);
    if (!receipt) throw new ApiError(404, "RECEIPT_NOT_FOUND", "ไม่พบใบเสร็จนี้");
    if (!ADMIN_ROLES.includes(user.role)) {
      const tenant = await tenantRepository.findByUserId(user.userId);
      if (!tenant || receipt.payment.invoice.contract.tenantId !== tenant.id) {
        throw new ApiError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
      }
    }
    return receipt;
  },

  // สร้างไฟล์ PDF จากข้อมูล ณ ปัจจุบัน แล้วบันทึกไว้ (เรียกตอนอนุมัติ และเป็น fallback ตอนดาวน์โหลด)
  async generateAndStore(receiptId: number): Promise<Buffer> {
    const receipt = await receiptRepository.findById(receiptId);
    if (!receipt) throw new ApiError(404, "RECEIPT_NOT_FOUND", "ไม่พบใบเสร็จนี้");

    const { payment } = receipt;
    const { invoice } = payment;
    const tenantUser = invoice.contract.tenant.user;

    const paidToDate = await receiptRepository.sumApprovedUpTo(invoice.id, receipt.id);
    const invoiceTotal = Number(invoice.total);

    const buffer = await renderReceiptPdf({
      issuerName: env.receipt.issuerName,
      issuerAddress: env.receipt.issuerAddress,
      receiptNumber: receipt.receiptNumber,
      issuedDate: formatDateBangkok(receipt.issuedAt),
      tenantName: `${tenantUser.firstName} ${tenantUser.lastName}`,
      roomNumber: invoice.contract.room.roomNumber,
      invoiceNumber: invoice.invoiceNumber,
      billingMonth: `${String(invoice.billingMonth.getUTCMonth() + 1).padStart(2, "0")}/${invoice.billingMonth.getUTCFullYear()}`,
      items: invoice.items.map((i) => ({ label: i.label, amount: Number(i.amount) })),
      fine: Number(invoice.fine),
      invoiceTotal,
      paidAmount: Number(payment.amount),
      paidToDate,
      balance: calculateRemainingBalance(invoiceTotal, paidToDate),
      methodLabel: METHOD_LABEL[payment.method] ?? payment.method,
      paymentDate: formatDateUTC(payment.paymentDate),
      referenceNumber: payment.referenceNumber ?? undefined,
    });

    const relativePath = path.posix.join("receipts", `${receipt.receiptNumber}.pdf`);
    await fs.mkdir(path.join(UPLOAD_ROOT, "receipts"), { recursive: true });
    await fs.writeFile(path.join(UPLOAD_ROOT, relativePath), buffer);
    await receiptRepository.setPdfPath(receipt.id, relativePath);

    return buffer;
  },

  async getPdf(id: number, user: AuthUser) {
    const receipt = await this.getByIdForUser(id, user);

    if (receipt.pdfFilePath) {
      const absolute = path.resolve(UPLOAD_ROOT, receipt.pdfFilePath);
      // กัน path traversal: ไฟล์ต้องอยู่ใต้โฟลเดอร์ uploads เท่านั้น
      if (absolute.startsWith(path.resolve(UPLOAD_ROOT) + path.sep)) {
        try {
          return { buffer: await fs.readFile(absolute), filename: `${receipt.receiptNumber}.pdf` };
        } catch {
          // ไฟล์หาย -> สร้างใหม่ด้านล่าง
        }
      }
    }

    return { buffer: await this.generateAndStore(receipt.id), filename: `${receipt.receiptNumber}.pdf` };
  },
};
