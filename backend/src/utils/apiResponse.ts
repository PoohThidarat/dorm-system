import { Response } from "express";

// หน้าที่ของไฟล์: มาตรฐาน Response format ของ API ทุก endpoint (ตาม spec ข้อ 29)

export function ok<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
