import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { userRepository } from "../repositories/user.repository";
import { ok, ApiError } from "../utils/apiResponse";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validator";

// หน้าที่ของไฟล์: รับ Request / ตรวจสอบ input ด้วย zod / เรียก service / ส่ง Response กลับ
// ไม่มี business logic อยู่ในไฟล์นี้ ทุกอย่างอยู่ใน auth.service.ts

export const authController = {
  async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input.email, input.password);
    return ok(res, result);
  },

  async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    return ok(res, result, 201);
  },

  async refresh(req: Request, res: Response) {
    const input = refreshTokenSchema.parse(req.body);
    const result = await authService.refresh(input.refreshToken);
    return ok(res, result);
  },

  async logout(req: Request, res: Response) {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
    await authService.logout(req.user.userId);
    return ok(res, { message: "ออกจากระบบสำเร็จ" });
  },

  async forgotPassword(req: Request, res: Response) {
    const input = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(input.email);
    // ตอบ success เสมอไม่ว่าจะเจออีเมลหรือไม่ ป้องกัน user enumeration
    return ok(res, { message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปแล้ว" });
  },

  async resetPassword(req: Request, res: Response) {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input.token, input.newPassword);
    return ok(res, { message: "ตั้งรหัสผ่านใหม่สำเร็จ" });
  },

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
    const input = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user.userId, input.currentPassword, input.newPassword);
    return ok(res, { message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  },

  async me(req: Request, res: Response) {
    if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
    const user = await userRepository.findById(req.user.userId);
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้งาน");

    return ok(res, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    });
  },
};
