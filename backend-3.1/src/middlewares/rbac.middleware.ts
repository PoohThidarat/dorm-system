import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiResponse";

// หน้าที่ของไฟล์: Role-Based Access Control middleware
// ใช้คู่กับ authenticate เสมอ (ต้องรัน authenticate ก่อน เพื่อให้มี req.user)
// ตัวอย่างการใช้: router.get('/admin/rooms', authenticate, requireRole('SUPER_ADMIN','ADMIN'), handler)
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
    }

    if (!allowedRoles.includes(req.user.role)) {
      // ห้าม User เข้าถึง URL ที่ไม่มีสิทธิ์ (spec ข้อ 3)
      throw new ApiError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
    }

    next();
  };
}
