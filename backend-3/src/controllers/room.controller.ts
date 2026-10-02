import { Request, Response } from "express";
import { RoomStatus } from "@prisma/client";
import { roomService, roomTypeService } from "../services/room.service";
import { ok } from "../utils/apiResponse";
import { parseListQuery } from "../utils/pagination";
import {
  changeRoomStatusSchema,
  createRoomSchema,
  createRoomTypeSchema,
  updateRoomSchema,
} from "../validators/room.validator";

// หน้าที่ของไฟล์: รับ Request / validate / เรียก service / ตอบกลับ สำหรับ Room Management

export const roomController = {
  async list(req: Request, res: Response) {
    const query = parseListQuery(req, "roomNumber");
    const status = typeof req.query.status === "string" ? (req.query.status as RoomStatus) : undefined;
    const roomTypeId = req.query.roomTypeId ? Number(req.query.roomTypeId) : undefined;

    const result = await roomService.list(query, { status, roomTypeId });
    return ok(res, result);
  },

  async getById(req: Request, res: Response) {
    const room = await roomService.getById(Number(req.params.id));
    return ok(res, room);
  },

  async create(req: Request, res: Response) {
    const input = createRoomSchema.parse(req.body);
    const room = await roomService.create(input);
    return ok(res, room, 201);
  },

  async update(req: Request, res: Response) {
    const input = updateRoomSchema.parse(req.body);
    const room = await roomService.update(Number(req.params.id), input);
    return ok(res, room);
  },

  async changeStatus(req: Request, res: Response) {
    const input = changeRoomStatusSchema.parse(req.body);
    const room = await roomService.changeStatus(Number(req.params.id), input.status);
    return ok(res, room);
  },

  async remove(req: Request, res: Response) {
    await roomService.remove(Number(req.params.id));
    return ok(res, { message: "ลบห้องพักสำเร็จ" });
  },

  async dashboardSummary(_req: Request, res: Response) {
    const summary = await roomService.dashboardSummary();
    return ok(res, summary);
  },
};

export const roomTypeController = {
  async list(_req: Request, res: Response) {
    const roomTypes = await roomTypeService.list();
    return ok(res, roomTypes);
  },

  async create(req: Request, res: Response) {
    const input = createRoomTypeSchema.parse(req.body);
    const roomType = await roomTypeService.create(input.name);
    return ok(res, roomType, 201);
  },
};
