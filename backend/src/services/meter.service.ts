import { env } from "../config/env";
import { roomRepository } from "../repositories/room.repository";
import { contractRepository } from "../repositories/contract.repository";
import { tenantRepository } from "../repositories/tenant.repository";
import { getMeterRepository } from "../repositories/meter.repository";
import { ApiError } from "../utils/apiResponse";
import { calculateElectricityBill, calculateUsage, calculateWaterBill } from "../utils/billing.util";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { CreateReadingInput, MeterKind } from "../validators/billing.validator";

// หน้าที่ของไฟล์: Business logic ของมิเตอร์น้ำ/ไฟ (spec ข้อ 9, 10)
//   Usage = Current - Previous,  Total = Usage x PricePerUnit
//   Current ต้องไม่น้อยกว่า Previous (rule #4)

function billFor(kind: MeterKind, usage: number, pricePerUnit: number): number {
  return kind === "water"
    ? calculateWaterBill(usage, pricePerUnit)
    : calculateElectricityBill(usage, pricePerUnit);
}

export const meterService = {
  async recordReading(kind: MeterKind, input: CreateReadingInput) {
    const repo = getMeterRepository(kind);

    const room = await roomRepository.findById(input.roomId);
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "ไม่พบห้องพักนี้");

    let meter = await repo.findMeterByRoomId(input.roomId);
    if (!meter) {
      const defaultPrice =
        kind === "water" ? env.billing.defaultWaterPrice : env.billing.defaultElectricityPrice;
      meter = await repo.createMeter(input.roomId, input.pricePerUnit ?? defaultPrice);
    }

    const existing = await repo.findReadingByMonth(meter.id, input.readingMonth);
    if (existing) {
      throw new ApiError(409, "READING_ALREADY_EXISTS", "ห้องนี้มีการจดมิเตอร์ของเดือนนี้แล้ว");
    }

    const latest = await repo.findLatestReading(meter.id);
    if (latest && latest.readingMonth > input.readingMonth) {
      throw new ApiError(
        400,
        "READING_OUT_OF_ORDER",
        "มีการจดมิเตอร์ของเดือนที่ใหม่กว่านี้แล้ว ไม่สามารถจดย้อนหลังได้",
      );
    }

    const previousMeter = latest ? Number(latest.currentMeter) : (input.previousMeter ?? 0);
    if (input.currentMeter < previousMeter) {
      throw new ApiError(
        400,
        "METER_LESS_THAN_PREVIOUS",
        `ค่ามิเตอร์ปัจจุบัน (${input.currentMeter}) ต้องไม่น้อยกว่าค่าก่อนหน้า (${previousMeter})`,
      );
    }

    const usage = calculateUsage(previousMeter, input.currentMeter);
    const total = billFor(kind, usage, Number(meter.pricePerUnit));

    return repo.createReading({
      meterId: meter.id,
      previousMeter,
      currentMeter: input.currentMeter,
      usage,
      total,
      readingMonth: input.readingMonth,
    });
  },

  // ข้อมูลล่าสุดของห้อง ใช้แสดงค่า "มิเตอร์ก่อนหน้า" และราคาต่อหน่วยในฟอร์มจด
  async latestForRoom(kind: MeterKind, roomId: number) {
    const repo = getMeterRepository(kind);
    const meter = await repo.findMeterByRoomId(roomId);
    if (!meter) {
      const defaultPrice =
        kind === "water" ? env.billing.defaultWaterPrice : env.billing.defaultElectricityPrice;
      return { hasMeter: false, previousMeter: 0, pricePerUnit: defaultPrice, lastReadingMonth: null };
    }
    const latest = await repo.findLatestReading(meter.id);
    return {
      hasMeter: true,
      previousMeter: latest ? Number(latest.currentMeter) : 0,
      pricePerUnit: Number(meter.pricePerUnit),
      lastReadingMonth: latest ? latest.readingMonth : null,
    };
  },

  async setPrice(kind: MeterKind, roomId: number, pricePerUnit: number) {
    const repo = getMeterRepository(kind);
    const room = await roomRepository.findById(roomId);
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "ไม่พบห้องพักนี้");

    const meter = await repo.findMeterByRoomId(roomId);
    if (!meter) return repo.createMeter(roomId, pricePerUnit);
    return repo.updatePrice(meter.id, pricePerUnit);
  },

  async history(kind: MeterKind, query: ListQuery, roomId?: number) {
    const { items, total } = await getMeterRepository(kind).findManyReadings(query, {
      roomIds: roomId ? [roomId] : undefined,
    });
    return paginatedResult(items, total, query);
  },

  // ประวัติการใช้น้ำ/ไฟของผู้เช่า (เฉพาะห้องที่ตัวเองเคยมีสัญญา) — rule #7
  async historyForTenantUser(kind: MeterKind, userId: number, query: ListQuery) {
    const tenant = await tenantRepository.findByUserId(userId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบข้อมูลผู้เช่า");

    const contracts = await contractRepository.findMany(
      { page: 1, pageSize: 100, skip: 0, take: 100, sortOrder: "desc" },
      { tenantId: tenant.id },
    );
    const roomIds = contracts.items.map((c) => c.roomId);
    if (roomIds.length === 0) return paginatedResult([], 0, query);

    const { items, total } = await getMeterRepository(kind).findManyReadings(query, { roomIds });
    return paginatedResult(items, total, query);
  },

  // ยอดเงินของห้องในเดือนที่ระบุ ใช้ตอนออกบิล (0 ถ้ายังไม่ได้จดมิเตอร์)
  async monthlyCharge(kind: MeterKind, roomId: number, month: Date) {
    const repo = getMeterRepository(kind);
    const meter = await repo.findMeterByRoomId(roomId);
    if (!meter) return { recorded: false, usage: 0, total: 0 };
    const reading = await repo.findReadingByMonth(meter.id, month);
    if (!reading) return { recorded: false, usage: 0, total: 0 };
    return { recorded: true, usage: Number(reading.usage), total: Number(reading.total) };
  },
};
