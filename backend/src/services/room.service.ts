import { RoomStatus } from "@prisma/client";
import { roomRepository, roomTypeRepository } from "../repositories/room.repository";
import { ApiError } from "../utils/apiResponse";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { CreateRoomInput, UpdateRoomInput } from "../validators/room.validator";

// หน้าที่ของไฟล์: Business logic ของ Room Management (spec ข้อ 5)

// การเปลี่ยนสถานะห้องที่อนุญาต ป้องกันการเปลี่ยนสถานะแบบผิด flow
// เช่น ห้องที่มีผู้เช่าอยู่ (OCCUPIED) ห้ามเปลี่ยนเป็น AVAILABLE ตรง ๆ ต้องยกเลิกสัญญาก่อน
const ALLOWED_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  AVAILABLE: ["RESERVED", "MAINTENANCE", "INACTIVE", "OCCUPIED"],
  RESERVED: ["AVAILABLE", "OCCUPIED", "INACTIVE"],
  OCCUPIED: ["MAINTENANCE"], // ปกติจะถูกเปลี่ยนกลับ AVAILABLE โดยระบบตอนยกเลิกสัญญาเท่านั้น
  MAINTENANCE: ["AVAILABLE", "INACTIVE"],
  INACTIVE: ["AVAILABLE"],
};

export const roomService = {
  async list(query: ListQuery, filters: { status?: RoomStatus; roomTypeId?: number }) {
    const { items, total } = await roomRepository.findMany(query, filters);
    return paginatedResult(items, total, query);
  },

  async getById(id: number) {
    const room = await roomRepository.findById(id);
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "ไม่พบห้องพักนี้");
    return room;
  },

  async create(input: CreateRoomInput) {
    const roomType = await roomTypeRepository.findById(input.roomTypeId);
    if (!roomType) throw new ApiError(400, "ROOM_TYPE_NOT_FOUND", "ไม่พบประเภทห้องที่ระบุ");

    const existing = await roomRepository.findByRoomNumber(input.roomNumber);
    if (existing) throw new ApiError(409, "ROOM_NUMBER_EXISTS", "เลขห้องนี้มีอยู่แล้ว");

    return roomRepository.create({
      roomNumber: input.roomNumber,
      floor: input.floor,
      roomType: { connect: { id: input.roomTypeId } },
      monthlyRent: input.monthlyRent,
      deposit: input.deposit,
      description: input.description,
      images: input.images ?? undefined,
    });
  },

  async update(id: number, input: UpdateRoomInput) {
    await this.getById(id); // throws 404 ถ้าไม่พบ

    if (input.roomTypeId) {
      const roomType = await roomTypeRepository.findById(input.roomTypeId);
      if (!roomType) throw new ApiError(400, "ROOM_TYPE_NOT_FOUND", "ไม่พบประเภทห้องที่ระบุ");
    }

    if (input.roomNumber) {
      const existing = await roomRepository.findByRoomNumber(input.roomNumber);
      if (existing && existing.id !== id) {
        throw new ApiError(409, "ROOM_NUMBER_EXISTS", "เลขห้องนี้มีอยู่แล้ว");
      }
    }

    return roomRepository.update(id, {
      ...(input.roomNumber ? { roomNumber: input.roomNumber } : {}),
      ...(input.floor !== undefined ? { floor: input.floor } : {}),
      ...(input.roomTypeId ? { roomType: { connect: { id: input.roomTypeId } } } : {}),
      ...(input.monthlyRent !== undefined ? { monthlyRent: input.monthlyRent } : {}),
      ...(input.deposit !== undefined ? { deposit: input.deposit } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.images ? { images: input.images } : {}),
    });
  },

  async changeStatus(id: number, newStatus: RoomStatus) {
    const room = await this.getById(id);

    if (room.status === newStatus) return room;

    const allowed = ALLOWED_TRANSITIONS[room.status];
    if (!allowed.includes(newStatus)) {
      throw new ApiError(
        400,
        "INVALID_STATUS_TRANSITION",
        `ไม่สามารถเปลี่ยนสถานะห้องจาก ${room.status} เป็น ${newStatus} ได้โดยตรง`,
      );
    }

    return roomRepository.update(id, { status: newStatus });
  },

  async remove(id: number) {
    await this.getById(id);

    const activeContracts = await roomRepository.countActiveContractsForRoom(id);
    if (activeContracts > 0) {
      throw new ApiError(
        409,
        "ROOM_HAS_ACTIVE_CONTRACT",
        "ไม่สามารถลบห้องที่มีสัญญาเช่าที่ยัง Active อยู่ได้",
      );
    }

    await roomRepository.softDelete(id);
  },

  async dashboardSummary() {
    const rows = await roomRepository.summary();
    const summary = { total: 0, available: 0, occupied: 0, maintenance: 0 };

    for (const row of rows) {
      summary.total += row._count._all;
      if (row.status === "AVAILABLE") summary.available += row._count._all;
      if (row.status === "OCCUPIED") summary.occupied += row._count._all;
      if (row.status === "MAINTENANCE") summary.maintenance += row._count._all;
    }

    return summary;
  },
};

export const roomTypeService = {
  list() {
    return roomTypeRepository.findAll();
  },

  async create(name: string) {
    const existing = await roomTypeRepository.findByName(name);
    if (existing) throw new ApiError(409, "ROOM_TYPE_EXISTS", "ประเภทห้องนี้มีอยู่แล้ว");
    return roomTypeRepository.create(name);
  },
};
