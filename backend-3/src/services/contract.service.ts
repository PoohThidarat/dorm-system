import { contractRepository } from "../repositories/contract.repository";
import { roomRepository } from "../repositories/room.repository";
import { tenantRepository } from "../repositories/tenant.repository";
import { ApiError } from "../utils/apiResponse";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { CreateContractInput, UpdateContractInput } from "../validators/contract.validator";

// หน้าที่ของไฟล์: Business logic ของ Rental Contract (spec ข้อ 7)
// กฎสำคัญ (spec ข้อ 40): ห้องหนึ่งห้องมีผู้เช่า Active ได้ตามที่กำหนด (ที่นี่ = 1 สัญญา Active ต่อห้อง)
// การสร้างสัญญาต้องเปลี่ยนสถานะห้องเป็น OCCUPIED และการยกเลิกต้องคืนห้องเป็น AVAILABLE เสมอ

export const contractService = {
  async list(query: ListQuery, filters: { tenantId?: number; roomId?: number; status?: string }) {
    const { items, total } = await contractRepository.findMany(query, filters);
    return paginatedResult(items, total, query);
  },

  async getById(id: number) {
    const contract = await contractRepository.findById(id);
    if (!contract) throw new ApiError(404, "CONTRACT_NOT_FOUND", "ไม่พบสัญญาเช่านี้");
    return contract;
  },

  async create(input: CreateContractInput) {
    const room = await roomRepository.findById(input.roomId);
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "ไม่พบห้องพักนี้");
    if (room.status !== "AVAILABLE" && room.status !== "RESERVED") {
      throw new ApiError(409, "ROOM_NOT_AVAILABLE", "ห้องนี้ไม่ว่าง ไม่สามารถสร้างสัญญาได้");
    }

    const tenant = await tenantRepository.findById(input.tenantId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบผู้เช่านี้");

    const existingActive = await contractRepository.findActiveByTenantId(input.tenantId);
    if (existingActive) {
      throw new ApiError(409, "TENANT_HAS_ACTIVE_CONTRACT", "ผู้เช่ารายนี้มีสัญญา Active อยู่แล้ว");
    }

    const contract = await contractRepository.create({
      room: { connect: { id: input.roomId } },
      tenant: { connect: { id: input.tenantId } },
      startDate: input.startDate,
      endDate: input.endDate,
      deposit: input.deposit,
    });

    await roomRepository.update(input.roomId, { status: "OCCUPIED" });
    await tenantRepository.setStatus(input.tenantId, "ACTIVE");

    return contract;
  },

  async update(id: number, input: UpdateContractInput) {
    await this.getById(id);
    return contractRepository.update(id, {
      ...(input.startDate ? { startDate: input.startDate } : {}),
      ...(input.endDate ? { endDate: input.endDate } : {}),
      ...(input.deposit !== undefined ? { deposit: input.deposit } : {}),
    });
  },

  async terminate(id: number) {
    const contract = await this.getById(id);
    if (contract.status !== "ACTIVE") {
      throw new ApiError(400, "CONTRACT_NOT_ACTIVE", "สัญญานี้ไม่ได้อยู่ในสถานะ Active");
    }

    await contractRepository.update(id, { status: "TERMINATED" });
    await roomRepository.update(contract.roomId, { status: "AVAILABLE" });
    await tenantRepository.setStatus(contract.tenantId, "MOVED_OUT");

    return this.getById(id);
  },

  // ย้ายห้อง = ปิดสัญญาเดิม (TERMINATED) แล้วเปิดสัญญาใหม่บนห้องใหม่ทันที (spec ข้อ 6 "ย้ายห้อง")
  async moveRoom(contractId: number, newRoomId: number) {
    const contract = await this.getById(contractId);
    if (contract.status !== "ACTIVE") {
      throw new ApiError(400, "CONTRACT_NOT_ACTIVE", "สัญญานี้ไม่ได้อยู่ในสถานะ Active");
    }

    const newRoom = await roomRepository.findById(newRoomId);
    if (!newRoom) throw new ApiError(404, "ROOM_NOT_FOUND", "ไม่พบห้องพักใหม่");
    if (newRoom.status !== "AVAILABLE") {
      throw new ApiError(409, "ROOM_NOT_AVAILABLE", "ห้องใหม่ไม่ว่าง");
    }

    const oldRoomId = contract.roomId;

    await contractRepository.update(contractId, { status: "TERMINATED" });
    await roomRepository.update(oldRoomId, { status: "AVAILABLE" });

    const newContract = await contractRepository.create({
      room: { connect: { id: newRoomId } },
      tenant: { connect: { id: contract.tenantId } },
      startDate: new Date(),
      endDate: contract.endDate,
      deposit: contract.deposit,
    });

    await roomRepository.update(newRoomId, { status: "OCCUPIED" });

    return newContract;
  },

  async attachPdf(id: number, pdfFilePath: string) {
    await this.getById(id);
    return contractRepository.setPdfPath(id, pdfFilePath);
  },

  expiringWithin(days: number) {
    return contractRepository.findExpiringWithin(days);
  },
};
