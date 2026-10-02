import { Request, Response } from "express";
import { invoiceService } from "../services/invoice.service";
import { ApiError, ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import {
  createInvoiceSchema,
  generateMonthlySchema,
  invoiceListFiltersSchema,
  updateInvoiceSchema,
} from "../validators/billing.validator";

// หน้าที่ของไฟล์: HTTP layer ของใบแจ้งหนี้ (spec ข้อ 8)

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  return req.user;
}

export const invoiceController = {
  async list(req: Request, res: Response) {
    const filters = invoiceListFiltersSchema.parse(req.query);
    return ok(res, await invoiceService.list(parseListQuery(req), filters));
  },

  async listMine(req: Request, res: Response) {
    const user = requireUser(req);
    const filters = invoiceListFiltersSchema.parse(req.query);
    return ok(res, await invoiceService.listForTenantUser(user.userId, parseListQuery(req), filters));
  },

  // Admin เห็นทุกบิล, Tenant เห็นเฉพาะบิลของตัวเอง (rule #7)
  async getById(req: Request, res: Response) {
    const user = requireUser(req);
    const id = Number(req.params.id);
    const invoice =
      user.role === "TENANT"
        ? await invoiceService.getByIdForTenantUser(id, user.userId)
        : await invoiceService.getById(id);
    return ok(res, invoice);
  },

  async create(req: Request, res: Response) {
    const result = await invoiceService.create(createInvoiceSchema.parse(req.body));
    return ok(res, result, 201);
  },

  async update(req: Request, res: Response) {
    const invoice = await invoiceService.update(Number(req.params.id), updateInvoiceSchema.parse(req.body));
    return ok(res, invoice);
  },

  async issue(req: Request, res: Response) {
    return ok(res, await invoiceService.issue(Number(req.params.id)));
  },

  async cancel(req: Request, res: Response) {
    return ok(res, await invoiceService.cancel(Number(req.params.id)));
  },

  async generateMonthly(req: Request, res: Response) {
    const input = generateMonthlySchema.parse(req.body ?? {});
    const month = input.billingMonth ?? invoiceService.previousMonth();
    return ok(res, await invoiceService.generateMonthly(month));
  },
};
