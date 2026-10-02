import type { Invoice, InvoiceStatus, PaymentMethod, PaymentStatus } from "./api";

// หน้าที่ของไฟล์: ฟังก์ชันจัดรูปแบบที่ใช้ร่วมกัน (spec ข้อ 28: วันที่ DD/MM/YYYY, สกุลเงิน THB / บาท)
// วันที่จาก API เก็บเป็น 00:00 UTC จึงอ่านด้วย UTC getter เสมอ เพื่อไม่ให้วันเลื่อนตาม timezone

export function formatTHB(value: number | string): string {
  return `${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function formatMonth(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// ค่าเริ่มต้นของ <input type="month"> = เดือนก่อนหน้า (เดือนที่จดมิเตอร์เสร็จแล้ว)
export function previousMonthValue(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "ร่าง",
  ISSUED: "รอชำระ",
  UNPAID: "ยังไม่ชำระ",
  PARTIAL: "ชำระบางส่วน",
  PAID: "ชำระแล้ว",
  OVERDUE: "เกินกำหนด",
  CANCELLED: "ยกเลิก",
};

export const INVOICE_STATUS_COLOR: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-200 text-slate-600",
  ISSUED: "bg-blue-100 text-blue-700",
  UNPAID: "bg-blue-100 text-blue-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "รอตรวจสอบ",
  APPROVED: "อนุมัติแล้ว",
  REJECTED: "ถูกปฏิเสธ",
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  BANK_TRANSFER: "โอนผ่านธนาคาร",
  QR_PAYMENT: "QR Payment",
  ONLINE: "ชำระออนไลน์",
};

// บิลที่รับชำระได้ (ต้องตรงกับฝั่ง backend: PAYABLE_INVOICE_STATUSES)
const PAYABLE: InvoiceStatus[] = ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"];

// ยอดที่ชำระแล้ว (เฉพาะรายการที่อนุมัติ) และยอดคงเหลือ — คิดเป็นสตางค์กัน floating point
export function invoicePaid(inv: Pick<Invoice, "payments">): number {
  const cents = inv.payments
    .filter((p) => p.status === "APPROVED")
    .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  return cents / 100;
}

export function invoiceBalance(inv: Pick<Invoice, "payments" | "total">): number {
  return Math.max(0, (Math.round(Number(inv.total) * 100) - Math.round(invoicePaid(inv) * 100)) / 100);
}

export function invoiceHasPendingPayment(inv: Pick<Invoice, "payments">): boolean {
  return inv.payments.some((p) => p.status === "PENDING");
}

export function canPayInvoice(inv: Pick<Invoice, "status" | "payments" | "total">): boolean {
  return PAYABLE.includes(inv.status) && invoiceBalance(inv) > 0 && !invoiceHasPendingPayment(inv);
}

export function todayValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
