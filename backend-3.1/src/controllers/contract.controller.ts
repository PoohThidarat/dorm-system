import { Request, Response } from "express";
import { contractService } from "../services/contract.service";
import { ok, ApiError } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import { createContractSchema, updateContractSchema } from "../validators/contract.validator";

// หน้าที่ของไฟล์: HTTP layer สำหรับ Rental Contract (spec ข้อ 7)

export const contractController = {
  async list(req: Request, res: Response) {
    const query = parseListQuery(req);
    const tenantId = req.query.tenantId ? Number(req.query.tenantId) : undefined;
    const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const result = await contractService.list(query, { tenantId, roomId, status });
    return ok(res, result);
  },

  async getById(req: Request, res: Response) {
    const contract = await contractService.getById(Number(req.params.id));
    return ok(res, contract);
  },

  async create(req: Request, res: Response) {
    const input = createContractSchema.parse(req.body);
    const contract = await contractService.create(input);
    return ok(res, contract, 201);
  },

  async update(req: Request, res: Response) {
    const input = updateContractSchema.parse(req.body);
    const contract = await contractService.update(Number(req.params.id), input);
    return ok(res, contract);
  },

  async terminate(req: Request, res: Response) {
    const contract = await contractService.terminate(Number(req.params.id));
    return ok(res, contract);
  },

  async uploadPdf(req: Request, res: Response) {
    if (!req.file) throw new ApiError(400, "FILE_REQUIRED", "กรุณาแนบไฟล์ PDF");
    const relativePath = `/uploads/contracts/${req.file.filename}`;
    const contract = await contractService.attachPdf(Number(req.params.id), relativePath);
    return ok(res, contract);
  },
};
