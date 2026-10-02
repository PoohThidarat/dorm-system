import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiResponse";
import { verifyAccessToken } from "../utils/jwt";

// หน้าที่ของไฟล์: ตรวจสอบว่า Request มี Access Token ที่ถูกต้องหรือไม่ (spec ข้อ 3, 24)
// ถ้าไม่มี/หมดอายุ/ไม่ถูกต้อง -> 401 Unauthorized ทันที ห้ามเข้าถึง route ถัดไป
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new ApiError(401, "TOKEN_INVALID", "Token ไม่ถูกต้องหรือหมดอายุ");
  }
}
