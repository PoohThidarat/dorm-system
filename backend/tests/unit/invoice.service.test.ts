// Unit Test ของ invoiceService: business rule #2, #3 และการคำนวณค่าปรับ/OVERDUE (spec ข้อ 40)

jest.mock("../../src/repositories/contract.repository", () => ({ contractRepository: { findById: jest.fn() } }));
jest.mock("../../src/repositories/tenant.repository", () => ({ tenantRepository: { findByUserId: jest.fn() } }));
jest.mock("../../src/services/meter.service", () => ({ meterService: { monthlyCharge: jest.fn() } }));
jest.mock("../../src/repositories/invoice.repository", () => ({
  invoiceRepository: {
    findByContractAndMonth: jest.fn(),
    countForMonth: jest.fn(),
    create: jest.fn(),
    findPastDue: jest.fn(),
    updateFine: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    countApprovedPayments: jest.fn(),
  },
}));

import { contractRepository } from "../../src/repositories/contract.repository";
import { tenantRepository } from "../../src/repositories/tenant.repository";
import { invoiceRepository } from "../../src/repositories/invoice.repository";
import { meterService } from "../../src/services/meter.service";
import { invoiceService } from "../../src/services/invoice.service";

const repo = invoiceRepository as jest.Mocked<typeof invoiceRepository>;
const contracts = contractRepository as jest.Mocked<typeof contractRepository>;
const meters = meterService as jest.Mocked<typeof meterService>;

const month = new Date(Date.UTC(2026, 8, 1));
const activeContract = {
  id: 5,
  roomId: 2,
  status: "ACTIVE",
  startDate: new Date(Date.UTC(2026, 0, 15)),
  room: { monthlyRent: 4000 },
};
const input = { contractId: 5, billingMonth: month, otherCharges: [], discount: 0, issue: false };

describe("invoiceService.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contracts.findById.mockResolvedValue(activeContract as never);
    repo.findByContractAndMonth.mockResolvedValue(null);
    repo.countForMonth.mockResolvedValue(2);
    repo.create.mockImplementation(async (d) => d as never);
    meters.monthlyCharge.mockImplementation(async (kind) =>
      kind === "water" ? { recorded: true, usage: 10, total: 180 } : { recorded: true, usage: 120, total: 960 },
    );
  });

  it("รวมค่าเช่า น้ำ ไฟ และออกเลขบิลตามลำดับ", async () => {
    const { invoice } = await invoiceService.create(input);
    expect(invoice).toMatchObject({
      invoiceNumber: "INV-202609-0003",
      rent: 4000,
      water: 180,
      electricity: 960,
      total: 5140,
      status: "DRAFT",
    });
  });

  it("ออกบิลทันทีเมื่อ issue = true และหักส่วนลด", async () => {
    const { invoice } = await invoiceService.create({ ...input, issue: true, discount: 140 });
    expect(invoice).toMatchObject({ status: "ISSUED", total: 5000 });
  });

  it("rule #2: ปฏิเสธเมื่อสัญญาไม่ Active", async () => {
    contracts.findById.mockResolvedValue({ ...activeContract, status: "TERMINATED" } as never);
    await expect(invoiceService.create(input)).rejects.toMatchObject({ errorCode: "NO_ACTIVE_CONTRACT" });
  });

  it("rule #3: ปฏิเสธบิลซ้ำเดือนเดียวกัน", async () => {
    repo.findByContractAndMonth.mockResolvedValue({ id: 1 } as never);
    await expect(invoiceService.create(input)).rejects.toMatchObject({ errorCode: "INVOICE_ALREADY_EXISTS" });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("ปฏิเสธเดือนที่อยู่ก่อนวันเริ่มสัญญา", async () => {
    await expect(
      invoiceService.create({ ...input, billingMonth: new Date(Date.UTC(2025, 11, 1)) }),
    ).rejects.toMatchObject({ errorCode: "BILLING_BEFORE_CONTRACT" });
  });

  it("แจ้งเตือนเมื่อยังไม่ได้จดมิเตอร์", async () => {
    meters.monthlyCharge.mockResolvedValue({ recorded: false, usage: 0, total: 0 });
    const result = await invoiceService.create(input);
    expect(result.missingReadings).toEqual({ water: true, electricity: true });
    expect(result.invoice.total).toBe(4000);
  });

  it("ปฏิเสธเมื่อส่วนลดมากกว่ายอดรวม", async () => {
    await expect(invoiceService.create({ ...input, discount: 999999 })).rejects.toMatchObject({
      errorCode: "INVALID_TOTAL",
    });
  });
});

describe("invoiceService.applyOverdueAndFines", () => {
  const pastDue = {
    id: 9,
    status: "ISSUED",
    rent: 4000,
    water: 500,
    electricity: 500,
    otherCharges: 0,
    discount: 0,
    fine: 0,
    dueDate: new Date(Date.UTC(2026, 8, 5)),
  };

  beforeEach(() => jest.clearAllMocks());

  it("เปลี่ยนเป็น OVERDUE และคิดค่าปรับ 1%/วัน", async () => {
    repo.findPastDue.mockResolvedValue([pastDue] as never);
    const result = await invoiceService.applyOverdueAndFines(new Date(Date.UTC(2026, 8, 10)));
    // ฐาน 5000, เกิน 5 วัน = 5% = 250
    expect(repo.updateFine).toHaveBeenCalledWith(9, 250, 5250, "OVERDUE");
    expect(result).toEqual({ checked: 1, updated: 1 });
  });

  it("รันซ้ำแล้วไม่อัปเดตถ้าค่าเท่าเดิม (idempotent)", async () => {
    repo.findPastDue.mockResolvedValue([{ ...pastDue, status: "OVERDUE", fine: 250 }] as never);
    const result = await invoiceService.applyOverdueAndFines(new Date(Date.UTC(2026, 8, 10)));
    expect(repo.updateFine).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  it("บิลจ่ายบางส่วนยังคงสถานะ PARTIAL แต่คิดค่าปรับ", async () => {
    repo.findPastDue.mockResolvedValue([{ ...pastDue, status: "PARTIAL" }] as never);
    await invoiceService.applyOverdueAndFines(new Date(Date.UTC(2026, 8, 10)));
    expect(repo.updateFine).toHaveBeenCalledWith(9, 250, 5250, "PARTIAL");
  });
});

describe("invoiceService.cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("ปฏิเสธการยกเลิกบิลที่จ่ายแล้ว", async () => {
    repo.findById.mockResolvedValue({ id: 1, status: "PAID" } as never);
    await expect(invoiceService.cancel(1)).rejects.toMatchObject({ errorCode: "INVOICE_NOT_CANCELLABLE" });
  });

  it("ปฏิเสธเมื่อมี payment ที่อนุมัติแล้ว", async () => {
    repo.findById.mockResolvedValue({ id: 1, status: "PARTIAL" } as never);
    repo.countApprovedPayments.mockResolvedValue(1);
    await expect(invoiceService.cancel(1)).rejects.toMatchObject({ errorCode: "INVOICE_HAS_PAYMENT" });
  });
});

describe("invoiceService.getByIdForTenantUser (rule #7)", () => {
  beforeEach(() => jest.clearAllMocks());
  const tenants = tenantRepository as jest.Mocked<typeof tenantRepository>;

  it("ผู้เช่าดูบิลของตัวเองที่ออกแล้วได้", async () => {
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    repo.findById.mockResolvedValue({ id: 1, status: "ISSUED", contract: { tenantId: 3 } } as never);
    await expect(invoiceService.getByIdForTenantUser(1, 20)).resolves.toMatchObject({ id: 1 });
  });

  it("ผู้เช่าดูบิลของคนอื่นไม่ได้ -> FORBIDDEN", async () => {
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    repo.findById.mockResolvedValue({ id: 1, status: "ISSUED", contract: { tenantId: 99 } } as never);
    await expect(invoiceService.getByIdForTenantUser(1, 20)).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });

  it("ผู้เช่าดูบิล DRAFT ของตัวเองไม่ได้", async () => {
    tenants.findByUserId.mockResolvedValue({ id: 3 } as never);
    repo.findById.mockResolvedValue({ id: 1, status: "DRAFT", contract: { tenantId: 3 } } as never);
    await expect(invoiceService.getByIdForTenantUser(1, 20)).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });

  it("ผู้ใช้ที่ไม่มีโปรไฟล์ผู้เช่าดูไม่ได้", async () => {
    tenants.findByUserId.mockResolvedValue(null);
    repo.findById.mockResolvedValue({ id: 1, status: "ISSUED", contract: { tenantId: 3 } } as never);
    await expect(invoiceService.getByIdForTenantUser(1, 20)).rejects.toMatchObject({ errorCode: "FORBIDDEN" });
  });
});
