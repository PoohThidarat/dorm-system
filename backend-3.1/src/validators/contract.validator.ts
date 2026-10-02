import { z } from "zod";

// หน้าที่ของไฟล์: ตรวจสอบ input ของ Rental Contract (spec ข้อ 7, 30)

export const createContractSchema = z
  .object({
    roomId: z.number().int().positive(),
    tenantId: z.number().int().positive(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    deposit: z.number().nonnegative(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "วันสิ้นสุดสัญญาต้องอยู่หลังวันเริ่มสัญญา",
    path: ["endDate"],
  });

export const updateContractSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    deposit: z.number().nonnegative().optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate > data.startDate, {
    message: "วันสิ้นสุดสัญญาต้องอยู่หลังวันเริ่มสัญญา",
    path: ["endDate"],
  });

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
