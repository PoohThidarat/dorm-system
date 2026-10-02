import { z } from "zod";

// หน้าที่ของไฟล์: ตรวจสอบ input ของการชำระเงิน (spec ข้อ 11, 30)
// หมายเหตุ: ฟอร์มแนบสลิปส่งแบบ multipart ทุกค่าเป็น string จึงใช้ z.coerce แปลงเป็นตัวเลข/วันที่

const paymentDateSchema = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, "วันที่ชำระเงินต้องไม่อยู่ในอนาคต");

const referenceSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));

// ผู้เช่าแจ้งชำระได้เฉพาะโอนธนาคาร/QR (ต้องแนบสลิป) — เงินสดให้ Admin เป็นผู้บันทึก
export const submitPaymentSchema = z.object({
  invoiceId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("จำนวนเงินต้องมากกว่า 0"),
  method: z.enum(["BANK_TRANSFER", "QR_PAYMENT"]),
  paymentDate: paymentDateSchema.default(() => new Date()),
  referenceNumber: referenceSchema,
});

export const recordPaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive("จำนวนเงินต้องมากกว่า 0"),
  method: z.enum(["CASH", "BANK_TRANSFER", "QR_PAYMENT"]),
  paymentDate: paymentDateSchema.default(() => new Date()),
  referenceNumber: referenceSchema,
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(3, "กรุณาระบุเหตุผลที่ปฏิเสธ").max(500),
});

export const paymentListFiltersSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  invoiceId: z.coerce.number().int().positive().optional(),
});

export type SubmitPaymentInput = z.infer<typeof submitPaymentSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
