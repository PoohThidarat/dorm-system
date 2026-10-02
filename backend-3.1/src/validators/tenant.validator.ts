import { z } from "zod";

// หน้าที่ของไฟล์: ตรวจสอบ input ของ Tenant Management (spec ข้อ 6, 30)

export const createTenantSchema = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^0\d{8,9}$/, "รูปแบบเบอร์โทรไม่ถูกต้อง").optional(),
  nationalId: z.string().regex(/^\d{13}$/, "เลขบัตรประชาชนต้องมี 13 หลัก"),
  address: z.string().optional(),
});

export const updateTenantSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().regex(/^0\d{8,9}$/).optional(),
  address: z.string().optional(),
});

export const moveRoomSchema = z.object({
  newRoomId: z.number().int().positive(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
