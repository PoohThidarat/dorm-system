// หน้าที่ของไฟล์: ฟังก์ชัน Business Logic ล้วน ๆ (pure function) สำหรับคำนวณบิล
// แยกออกมาต่างหากเพื่อให้เขียน Unit Test ได้ง่าย ไม่ต้องยุ่งกับ DB (spec ข้อ 32)

export function calculateUsage(previousMeter: number, currentMeter: number): number {
  if (currentMeter < previousMeter) {
    throw new Error("ค่ามิเตอร์ปัจจุบันต้องไม่น้อยกว่าค่ามิเตอร์ก่อนหน้า");
  }
  return currentMeter - previousMeter;
}

export function calculateWaterBill(usage: number, pricePerUnit: number): number {
  return round2(usage * pricePerUnit);
}

export function calculateElectricityBill(usage: number, pricePerUnit: number): number {
  return round2(usage * pricePerUnit);
}

export interface InvoiceAmounts {
  rent: number;
  water: number;
  electricity: number;
  otherCharges: number;
  discount: number;
  fine: number;
}

export function calculateTotalInvoice(amounts: InvoiceAmounts): number {
  const { rent, water, electricity, otherCharges, discount, fine } = amounts;
  return round2(rent + water + electricity + otherCharges - discount + fine);
}

// ค่าปรับล่าช้า: คิด % ของยอดรวมต่อวันที่เกินกำหนด สูงสุดไม่เกิน cap ที่กำหนด (ป้องกันค่าปรับบานปลาย)
const LATE_FEE_PERCENT_PER_DAY = 0.01; // 1% ต่อวัน
const LATE_FEE_MAX_PERCENT = 0.3; // ไม่เกิน 30% ของยอดก่อนค่าปรับ

export function calculateLateFee(invoiceTotalBeforeFine: number, overdueDays: number): number {
  if (overdueDays <= 0) return 0;
  const percent = Math.min(overdueDays * LATE_FEE_PERCENT_PER_DAY, LATE_FEE_MAX_PERCENT);
  return round2(invoiceTotalBeforeFine * percent);
}

export function generateInvoiceNumber(billingMonth: Date, sequence: number): string {
  const yyyymm = `${billingMonth.getFullYear()}${String(billingMonth.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${yyyymm}-${String(sequence).padStart(4, "0")}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
