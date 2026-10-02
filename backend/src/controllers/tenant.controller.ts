import { Request, Response } from "express";
import { TenantStatus } from "@prisma/client";
import { tenantService } from "../services/tenant.service";
import { ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import { createTenantSchema, moveRoomSchema, updateTenantSchema } from "../validators/tenant.validator";

// หน้าที่ของไฟล์: HTTP layer สำหรับ Tenant Management (spec ข้อ 6)

export const tenantController = {
  async list(req: Request, res: Response) {
    const query = parseListQuery(req);
    const status = typeof req.query.status === "string" ? (req.query.status as TenantStatus) : undefined;
    const result = await tenantService.list(query, { status });
    return ok(res, result);
  },

  async getById(req: Request, res: Response) {
    const tenant = await tenantService.getById(Number(req.params.id));
    return ok(res, tenant);
  },

  async create(req: Request, res: Response) {
    const input = createTenantSchema.parse(req.body);
    const tenant = await tenantService.create(input);
    return ok(res, tenant, 201);
  },

  async update(req: Request, res: Response) {
    const input = updateTenantSchema.parse(req.body);
    const tenant = await tenantService.update(Number(req.params.id), input);
    return ok(res, tenant);
  },

  async moveRoom(req: Request, res: Response) {
    const input = moveRoomSchema.parse(req.body);
    const contract = await tenantService.moveRoom(Number(req.params.id), input.newRoomId);
    return ok(res, contract);
  },

  async cancelRental(req: Request, res: Response) {
    const contract = await tenantService.cancelRental(Number(req.params.id));
    return ok(res, contract);
  },

  async remove(req: Request, res: Response) {
    await tenantService.remove(Number(req.params.id));
    return ok(res, { message: "ลบผู้เช่าสำเร็จ" });
  },
};
