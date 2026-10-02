import { z } from "zod";

// หน้าที่ของไฟล์: กำหนด Schema สำหรับตรวจสอบ input ของทุก endpoint ใน auth module (spec ข้อ 30)

export const loginSchema = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export const registerSchema = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^0\d{8,9}$/, "รูปแบบเบอร์โทรไม่ถูกต้อง").optional(),
  roleName: z.enum(["SUPER_ADMIN", "ADMIN", "TENANT", "TECHNICIAN"]),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
