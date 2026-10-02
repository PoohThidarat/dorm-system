// หน้าที่ของไฟล์: ฟังก์ชันวันที่สำหรับงานบิล
// ทุกเดือนบิลเก็บเป็น "วันที่ 1 เวลา 00:00 UTC" เพื่อกัน timezone ทำให้เดือนเพี้ยน
// และใช้เวลาไทย (UTC+7) ตอนถามว่า "เดือนปัจจุบันคือเดือนอะไร"

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-09" -> 2026-09-01T00:00:00Z
export function parseBillingMonth(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function monthStartUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function currentBillingMonth(now: Date = new Date()): Date {
  return monthStartUTC(new Date(now.getTime() + BANGKOK_OFFSET_MS));
}

export function previousBillingMonth(now: Date = new Date()): Date {
  const current = currentBillingMonth(now);
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
}

// ค่าเริ่มต้นวันครบกำหนดชำระ = วันที่ 5 ของเดือนถัดจากเดือนที่ออกบิล
export function defaultDueDate(billingMonth: Date, dayOfMonth = 5): Date {
  return new Date(Date.UTC(billingMonth.getUTCFullYear(), billingMonth.getUTCMonth() + 1, dayOfMonth));
}

// จำนวนวันเต็มที่ a เลย b ไปแล้ว (ค่าติดลบ = ยังไม่ถึง)
export function diffInDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}
