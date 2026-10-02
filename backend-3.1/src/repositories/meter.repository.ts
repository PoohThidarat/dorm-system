import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository ของมิเตอร์น้ำและมิเตอร์ไฟ (spec ข้อ 9-10)
// ทั้งสองชนิดมีโครงสร้างเหมือนกัน จึงใช้ interface MeterRepository ร่วมกัน
// แล้ว service เลือกใช้ตามชนิด (water/electricity) โดยไม่ต้องเขียน logic ซ้ำ

export interface MeterRow {
  id: number;
  roomId: number;
  pricePerUnit: Prisma.Decimal;
}

export interface ReadingRow {
  id: number;
  meterId: number;
  previousMeter: Prisma.Decimal;
  currentMeter: Prisma.Decimal;
  usage: Prisma.Decimal;
  total: Prisma.Decimal;
  readingMonth: Date;
  createdAt: Date;
}

export interface ReadingWithRoom extends ReadingRow {
  meter: MeterRow & { room: { id: number; roomNumber: string } };
}

export interface NewReading {
  meterId: number;
  previousMeter: number;
  currentMeter: number;
  usage: number;
  total: number;
  readingMonth: Date;
}

export interface ReadingFilters {
  roomIds?: number[];
}

export interface MeterRepository {
  findMeterByRoomId(roomId: number): Promise<MeterRow | null>;
  createMeter(roomId: number, pricePerUnit: number): Promise<MeterRow>;
  updatePrice(meterId: number, pricePerUnit: number): Promise<MeterRow>;
  findLatestReading(meterId: number): Promise<ReadingRow | null>;
  findReadingByMonth(meterId: number, month: Date): Promise<ReadingRow | null>;
  createReading(data: NewReading): Promise<ReadingRow>;
  findManyReadings(
    query: ListQuery,
    filters: ReadingFilters,
  ): Promise<{ items: ReadingWithRoom[]; total: number }>;
}

const readingInclude = { meter: { include: { room: { select: { id: true, roomNumber: true } } } } };

export const waterMeterRepository: MeterRepository = {
  findMeterByRoomId: (roomId) => prisma.waterMeter.findUnique({ where: { roomId } }),
  createMeter: (roomId, pricePerUnit) => prisma.waterMeter.create({ data: { roomId, pricePerUnit } }),
  updatePrice: (meterId, pricePerUnit) =>
    prisma.waterMeter.update({ where: { id: meterId }, data: { pricePerUnit } }),
  findLatestReading: (meterId) =>
    prisma.waterReading.findFirst({ where: { meterId }, orderBy: { readingMonth: "desc" } }),
  findReadingByMonth: (meterId, month) =>
    prisma.waterReading.findUnique({ where: { meterId_readingMonth: { meterId, readingMonth: month } } }),
  createReading: (data) => prisma.waterReading.create({ data }),
  async findManyReadings(query, filters) {
    const where: Prisma.WaterReadingWhereInput = filters.roomIds
      ? { meter: { roomId: { in: filters.roomIds } } }
      : {};
    const [items, total] = await Promise.all([
      prisma.waterReading.findMany({
        where,
        include: readingInclude,
        orderBy: [{ readingMonth: "desc" }, { id: "desc" }],
        skip: query.skip,
        take: query.take,
      }),
      prisma.waterReading.count({ where }),
    ]);
    return { items, total };
  },
};

export const electricityMeterRepository: MeterRepository = {
  findMeterByRoomId: (roomId) => prisma.electricityMeter.findUnique({ where: { roomId } }),
  createMeter: (roomId, pricePerUnit) =>
    prisma.electricityMeter.create({ data: { roomId, pricePerUnit } }),
  updatePrice: (meterId, pricePerUnit) =>
    prisma.electricityMeter.update({ where: { id: meterId }, data: { pricePerUnit } }),
  findLatestReading: (meterId) =>
    prisma.electricityReading.findFirst({ where: { meterId }, orderBy: { readingMonth: "desc" } }),
  findReadingByMonth: (meterId, month) =>
    prisma.electricityReading.findUnique({
      where: { meterId_readingMonth: { meterId, readingMonth: month } },
    }),
  createReading: (data) => prisma.electricityReading.create({ data }),
  async findManyReadings(query, filters) {
    const where: Prisma.ElectricityReadingWhereInput = filters.roomIds
      ? { meter: { roomId: { in: filters.roomIds } } }
      : {};
    const [items, total] = await Promise.all([
      prisma.electricityReading.findMany({
        where,
        include: readingInclude,
        orderBy: [{ readingMonth: "desc" }, { id: "desc" }],
        skip: query.skip,
        take: query.take,
      }),
      prisma.electricityReading.count({ where }),
    ]);
    return { items, total };
  },
};

export function getMeterRepository(kind: "water" | "electricity"): MeterRepository {
  return kind === "water" ? waterMeterRepository : electricityMeterRepository;
}
