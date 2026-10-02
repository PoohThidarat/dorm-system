import { ApiError } from "../../src/utils/apiResponse";

// Unit Test ของ meterService (spec ข้อ 9, 30): mock repository ทั้งหมด ไม่ต้องต่อ DB
// ใช้ factory mock เพื่อไม่ให้ไปโหลด Prisma Client จริง

const fakeRepo = {
  findMeterByRoomId: jest.fn(),
  createMeter: jest.fn(),
  updatePrice: jest.fn(),
  findLatestReading: jest.fn(),
  findReadingByMonth: jest.fn(),
  createReading: jest.fn(),
  findManyReadings: jest.fn(),
};

jest.mock("../../src/config/env", () => ({
  env: { billing: { defaultWaterPrice: 18, defaultElectricityPrice: 8 } },
}));
jest.mock("../../src/repositories/meter.repository", () => ({ getMeterRepository: () => fakeRepo }));
jest.mock("../../src/repositories/room.repository", () => ({ roomRepository: { findById: jest.fn() } }));
jest.mock("../../src/repositories/contract.repository", () => ({ contractRepository: {} }));
jest.mock("../../src/repositories/tenant.repository", () => ({ tenantRepository: {} }));

import { roomRepository } from "../../src/repositories/room.repository";
import { meterService } from "../../src/services/meter.service";

const month = new Date(Date.UTC(2026, 8, 1));
const baseInput = { roomId: 1, readingMonth: month, currentMeter: 125 };

describe("meterService.recordReading", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (roomRepository.findById as jest.Mock).mockResolvedValue({ id: 1 });
    fakeRepo.findMeterByRoomId.mockResolvedValue({ id: 10, roomId: 1, pricePerUnit: 18 });
    fakeRepo.findReadingByMonth.mockResolvedValue(null);
    fakeRepo.findLatestReading.mockResolvedValue({ currentMeter: 100, readingMonth: new Date(Date.UTC(2026, 7, 1)) });
    fakeRepo.createReading.mockImplementation(async (d) => d);
  });

  it("คำนวณ usage และ total จากมิเตอร์ก่อนหน้า", async () => {
    const result = await meterService.recordReading("water", baseInput);
    expect(result).toMatchObject({ previousMeter: 100, currentMeter: 125, usage: 25, total: 450 });
  });

  it("ปฏิเสธเมื่อ Current น้อยกว่า Previous", async () => {
    await expect(meterService.recordReading("water", { ...baseInput, currentMeter: 90 })).rejects.toMatchObject({
      errorCode: "METER_LESS_THAN_PREVIOUS",
    });
    expect(fakeRepo.createReading).not.toHaveBeenCalled();
  });

  it("ปฏิเสธการจดซ้ำในเดือนเดียวกัน", async () => {
    fakeRepo.findReadingByMonth.mockResolvedValue({ id: 1 });
    await expect(meterService.recordReading("water", baseInput)).rejects.toMatchObject({
      errorCode: "READING_ALREADY_EXISTS",
    });
  });

  it("ปฏิเสธการจดย้อนหลังเมื่อมีเดือนที่ใหม่กว่าแล้ว", async () => {
    fakeRepo.findLatestReading.mockResolvedValue({ currentMeter: 200, readingMonth: new Date(Date.UTC(2026, 9, 1)) });
    await expect(meterService.recordReading("water", baseInput)).rejects.toMatchObject({
      errorCode: "READING_OUT_OF_ORDER",
    });
  });

  it("การจดครั้งแรกใช้ previousMeter ที่ส่งมา (หรือ 0) และสร้างมิเตอร์ด้วยราคา default", async () => {
    fakeRepo.findMeterByRoomId.mockResolvedValue(null);
    fakeRepo.findLatestReading.mockResolvedValue(null);
    fakeRepo.createMeter.mockResolvedValue({ id: 11, roomId: 1, pricePerUnit: 8 });

    const result = await meterService.recordReading("electricity", { ...baseInput, currentMeter: 50 });
    expect(fakeRepo.createMeter).toHaveBeenCalledWith(1, 8);
    expect(result).toMatchObject({ previousMeter: 0, usage: 50, total: 400 });
  });

  it("ปฏิเสธเมื่อไม่พบห้อง", async () => {
    (roomRepository.findById as jest.Mock).mockResolvedValue(null);
    await expect(meterService.recordReading("water", baseInput)).rejects.toBeInstanceOf(ApiError);
  });
});
