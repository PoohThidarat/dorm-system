import fs from "fs/promises";
import path from "path";
import { Request, Response } from "express";
import { paymentService } from "../services/payment.service";
import { ApiError, ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import {
  paymentListFiltersSchema,
  recordPaymentSchema,
  rejectPaymentSchema,
  submitPaymentSchema,
} from "../validators/payment.validator";

// หน้าที่ของไฟล์: HTTP layer ของการชำระเงิน (spec ข้อ 11)

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  return req.user;
}

export const paymentController = {
  async list(req: Request, res: Response) {
    const filters = paymentListFiltersSchema.parse(req.query);
    return ok(res, await paymentService.list(parseListQuery(req), filters));
  },

  async listMine(req: Request, res: Response) {
    const user = requireUser(req);
    const filters = paymentListFiltersSchema.parse(req.query);
    return ok(res, await paymentService.listForTenantUser(user.userId, parseListQuery(req), filters));
  },

  async getById(req: Request, res: Response) {
    return ok(res, await paymentService.getByIdForUser(Number(req.params.id), requireUser(req)));
  },

  // multipart: field "slip" (ไฟล์) + invoiceId, amount, method, paymentDate, referenceNumber
  async submit(req: Request, res: Response) {
    const user = requireUser(req);
    try {
      const input = submitPaymentSchema.parse(req.body);
      // เก็บ path แบบสัมพันธ์กับโฟลเดอร์ uploads เพื่อย้ายที่เก็บไฟล์ได้ในอนาคต
      const slipPath = req.file ? path.posix.join("payment-slips", req.file.filename) : undefined;
      const payment = await paymentService.submit(user.userId, input, slipPath);
      return ok(res, payment, 201);
    } catch (err) {
      // ตรวจไม่ผ่าน -> ลบไฟล์ที่เพิ่งอัปโหลดทิ้ง ไม่ให้ไฟล์กำพร้าสะสมในเซิร์ฟเวอร์
      if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
      throw err;
    }
  },

  async record(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await paymentService.recordByAdmin(user.userId, recordPaymentSchema.parse(req.body));
    return ok(res, result, 201);
  },

  async approve(req: Request, res: Response) {
    const user = requireUser(req);
    return ok(res, await paymentService.approve(Number(req.params.id), user.userId));
  },

  async reject(req: Request, res: Response) {
    const user = requireUser(req);
    const { reason } = rejectPaymentSchema.parse(req.body);
    return ok(res, await paymentService.reject(Number(req.params.id), user.userId, reason));
  },

  async slip(req: Request, res: Response) {
    const absolutePath = await paymentService.getSlipFile(Number(req.params.id), requireUser(req));
    res.setHeader("Cache-Control", "private, no-store");
    res.sendFile(absolutePath);
  },
};
