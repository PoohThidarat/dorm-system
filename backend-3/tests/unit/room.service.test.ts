import { roomService } from "../../src/services/room.service";
import { roomRepository } from "../../src/repositories/room.repository";
import { ApiError } from "../../src/utils/apiResponse";

// หน้าที่ของไฟล์: Unit Test สำหรับกฎการเปลี่ยนสถานะห้อง (spec ข้อ 32-style, business rule ของข้อ 5)
// Mock repository ทั้งหมดเพื่อทดสอบเฉพาะ business logic โดยไม่ต้องต่อ database จริง

jest.mock("../../src/repositories/room.repository");

const mockedRepo = roomRepository as jest.Mocked<typeof roomRepository>;

function fakeRoom(overrides: Partial<{ id: number; status: string }> = {}) {
  return {
    id: 1,
    roomNumber: "101",
    floor: 1,
    roomTypeId: 1,
    monthlyRent: 4000,
    deposit: 8000,
    status: "AVAILABLE",
    description: null,
    images: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    roomType: { id: 1, name: "มาตรฐาน", createdAt: new Date() },
    ...overrides,
  } as any;
}

describe("roomService.changeStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("อนุญาตให้เปลี่ยนจาก AVAILABLE เป็น MAINTENANCE ได้", async () => {
    mockedRepo.findById.mockResolvedValue(fakeRoom({ status: "AVAILABLE" }));
    mockedRepo.update.mockResolvedValue(fakeRoom({ status: "MAINTENANCE" }));

    const result = await roomService.changeStatus(1, "MAINTENANCE" as any);
    expect(result.status).toBe("MAINTENANCE");
    expect(mockedRepo.update).toHaveBeenCalledWith(1, { status: "MAINTENANCE" });
  });

  it("ไม่อนุญาตให้เปลี่ยนจาก OCCUPIED เป็น AVAILABLE โดยตรง (ต้องยกเลิกสัญญาก่อน)", async () => {
    mockedRepo.findById.mockResolvedValue(fakeRoom({ status: "OCCUPIED" }));

    await expect(roomService.changeStatus(1, "AVAILABLE" as any)).rejects.toThrow(ApiError);
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });

  it("ไม่ทำอะไรถ้าสถานะเดิมเหมือนสถานะใหม่", async () => {
    mockedRepo.findById.mockResolvedValue(fakeRoom({ status: "AVAILABLE" }));

    const result = await roomService.changeStatus(1, "AVAILABLE" as any);
    expect(result.status).toBe("AVAILABLE");
    expect(mockedRepo.update).not.toHaveBeenCalled();
  });
});
