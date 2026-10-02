import type { InvoiceStatus } from "./api";

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
