import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/apiResponse";

// หน้าที่ของไฟล์: Global Error Handler ตัวเดียวสำหรับทั้งแอป (spec ข้อ 29)
// ทุก Controller ควร throw error แล้วปล่อยให้ middleware นี้จัดรูปแบบ response
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorCode: err.errorCode,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "ข้อมูลไม่ถูกต้อง",
      errorCode: "VALIDATION_ERROR",
      details: err.flatten(),
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "เกิดข้อผิดพลาดในระบบ",
    errorCode: "INTERNAL_SERVER_ERROR",
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `ไม่พบ endpoint: ${req.method} ${req.originalUrl}`,
    errorCode: "NOT_FOUND",
  });
}
