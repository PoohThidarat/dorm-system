import { Request, Response } from "express";
import { receiptService } from "../services/receipt.service";
import { ApiError, ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: HTTP layer ของใบเสร็จ (spec ข้อ 12): ดูรายการ / ดูรายใบ / ดาวน์โหลด-พิมพ์ PDF

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  return req.user;
}

export const receiptController = {
  async list(req: Request, res: Response) {
    return ok(res, await receiptService.list(parseListQuery(req)));
  },

  async listMine(req: Request, res: Response) {
    const user = requireUser(req);
    return ok(res, await receiptService.listForTenantUser(user.userId, parseListQuery(req)));
  },

  async getById(req: Request, res: Response) {
    return ok(res, await receiptService.getByIdForUser(Number(req.params.id), requireUser(req)));
  },

  // ?download=1 -> บังคับดาวน์โหลด, ไม่ใส่ -> เปิดดู/พิมพ์ในเบราว์เซอร์ (inline)
  async pdf(req: Request, res: Response) {
    const { buffer, filename } = await receiptService.getPdf(Number(req.params.id), requireUser(req));
    const disposition = req.query.download === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  },
};
