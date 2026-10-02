import { z } from "zod";
import { parseBillingMonth } from "../utils/date.util";

// หน้าที่ของไฟล์: ตรวจสอบ input ของมิเตอร์น้ำ/ไฟ และใบแจ้งหนี้ (spec ข้อ 8-10, 30)

export const meterKindSchema = z.enum(["water", "electricity"]);
export type MeterKind = z.infer<typeof meterKindSchema>;

// รับ "YYYY-MM" แล้วแปลงเป็น Date วันที่ 1 (UTC)
export const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "รูปแบบเดือนต้องเป็น YYYY-MM")
  .transform(parseBillingMonth);

export const createReadingSchema = z.object({
  roomId: z.number().int().positive(),
  readingMonth: monthSchema,
  currentMeter: z.number().nonnegative("ค่ามิเตอร์ต้องไม่ติดลบ"),
  // ใช้เฉพาะการจดครั้งแรกของห้อง (ยังไม่มีค่าก่อนหน้า) ถ้าไม่ส่งจะเริ่มที่ 0
  previousMeter: z.number().nonnegative().optional(),
  // ตั้งราคาต่อหน่วยตอนสร้างมิเตอร์ครั้งแรก (ถ้าไม่ส่งใช้ค่า default จาก .env)
  pricePerUnit: z.number().positive().optional(),
});

export const setMeterPriceSchema = z.object({
  pricePerUnit: z.number().positive("ราคาต่อหน่วยต้องมากกว่า 0"),
});

export const otherChargeSchema = z.object({
  label: z.string().min(1, "กรุณาระบุชื่อรายการ"),
  amount: z.number().positive("จำนวนเงินต้องมากกว่า 0"),
});

export const createInvoiceSchema = z.object({
  contractId: z.number().int().positive(),
  billingMonth: monthSchema,
  otherCharges: z.array(otherChargeSchema).default([]),
  discount: z.number().nonnegative().default(0),
  dueDate: z.coerce.date().optional(),
  issue: z.boolean().default(false), // true = ออกบิลทันที (ISSUED) แทน DRAFT
});

export const updateInvoiceSchema = z.object({
  otherCharges: z.array(otherChargeSchema).optional(),
  discount: z.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
});

export const generateMonthlySchema = z.object({
  billingMonth: monthSchema.optional(),
});

export const invoiceStatusSchema = z.enum([
  "DRAFT",
  "ISSUED",
  "UNPAID",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const invoiceListFiltersSchema = z.object({
  status: invoiceStatusSchema.optional(),
  billingMonth: monthSchema.optional(),
  contractId: z.coerce.number().int().positive().optional(),
});

export type CreateReadingInput = z.infer<typeof createReadingSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type OtherCharge = z.infer<typeof otherChargeSchema>;
