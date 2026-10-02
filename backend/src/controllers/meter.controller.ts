import { Request, Response } from "express";
import { meterService } from "../services/meter.service";
import { ApiError, ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import { createReadingSchema, meterKindSchema, setMeterPriceSchema } from "../validators/billing.validator";

// หน้าที่ของไฟล์: HTTP layer ของมิเตอร์น้ำ/ไฟ (spec ข้อ 9, 10)
// :kind = "water" | "electricity" (ใช้ controller เดียวกันทั้งสองชนิด)

function kindOf(req: Request) {
  return meterKindSchema.parse(req.params.kind);
}

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  return req.user;
}

export const meterController = {
  async record(req: Request, res: Response) {
    const reading = await meterService.recordReading(kindOf(req), createReadingSchema.parse(req.body));
    return ok(res, reading, 201);
  },

  async history(req: Request, res: Response) {
    const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;
    const result = await meterService.history(kindOf(req), parseListQuery(req), roomId);
    return ok(res, result);
  },

  async latest(req: Request, res: Response) {
    const roomId = Number(req.query.roomId);
    if (!roomId) throw new ApiError(400, "ROOM_ID_REQUIRED", "กรุณาระบุ roomId");
    return ok(res, await meterService.latestForRoom(kindOf(req), roomId));
  },

  async setPrice(req: Request, res: Response) {
    const input = setMeterPriceSchema.parse(req.body);
    const meter = await meterService.setPrice(kindOf(req), Number(req.params.roomId), input.pricePerUnit);
    return ok(res, meter);
  },

  async myHistory(req: Request, res: Response) {
    const user = requireUser(req);
    const result = await meterService.historyForTenantUser(kindOf(req), user.userId, parseListQuery(req));
    return ok(res, result);
  },
};
