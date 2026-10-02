import { NextFunction, Request, Response } from "express";

// หน้าที่ของไฟล์: ห่อ async controller function เพื่อส่ง error เข้า errorHandler อัตโนมัติ
type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncFn) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
