import { contractRepository } from "../repositories/contract.repository";
import { invoiceRepository, InvoiceFilters } from "../repositories/invoice.repository";
import { tenantRepository } from "../repositories/tenant.repository";
import { ApiError } from "../utils/apiResponse";
import {
  calculateLateFee,
  calculateTotalInvoice,
  generateInvoiceNumber,
} from "../utils/billing.util";
import {
  currentBillingMonth,
  defaultDueDate,
  diffInDays,
  monthStartUTC,
  previousBillingMonth,
} from "../utils/date.util";
import { ListQuery, paginatedResult } from "../utils/pagination";
import { CreateInvoiceInput, OtherCharge, UpdateInvoiceInput } from "../validators/billing.validator";
import { meterService } from "./meter.service";

// หน้าที่ของไฟล์: Business logic ของใบแจ้งหนี้ (spec ข้อ 8, 40)
//   rule #2  ผู้เช่าที่ไม่มี Active Contract สร้างบิลใหม่ไม่ได้
//   rule #3  ห้ามสร้างบิลซ้ำเดือนเดียวกันของสัญญาเดียวกัน
// ความหมายสถานะ: DRAFT = ร่าง (ผู้เช่ายังไม่เห็นว่าต้องจ่าย), ISSUED/UNPAID = ออกบิลแล้วรอชำระ,
//   PARTIAL = จ่ายบางส่วน (Phase 4), PAID = จ่ายครบ, OVERDUE = เลยกำหนด, CANCELLED = ยกเลิก

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (charges: OtherCharge[]) => round2(charges.reduce((acc, c) => acc + c.amount, 0));

interface BuildItemsInput {
  rent: number;
  water: { usage: number; total: number };
  electricity: { usage: number; total: number };
  otherCharges: OtherCharge[];
  discount: number;
}

function buildItems(input: BuildItemsInput) {
  const items: { label: string; amount: number }[] = [{ label: "ค่าเช่าห้อง", amount: input.rent }];
  if (input.water.total > 0) {
    items.push({ label: `ค่าน้ำ (${input.water.usage} หน่วย)`, amount: input.water.total });
  }
  if (input.electricity.total > 0) {
    items.push({ label: `ค่าไฟ (${input.electricity.usage} หน่วย)`, amount: input.electricity.total });
  }
  for (const charge of input.otherCharges) items.push({ label: charge.label, amount: charge.amount });
  if (input.discount > 0) items.push({ label: "ส่วนลด", amount: -input.discount });
  return items;
}

export const invoiceService = {
  async list(query: ListQuery, filters: InvoiceFilters) {
    const { items, total } = await invoiceRepository.findMany(query, filters);
    return paginatedResult(items, total, query);
  },

  async getById(id: number) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new ApiError(404, "INVOICE_NOT_FOUND", "ไม่พบใบแจ้งหนี้นี้");
    return invoice;
  },

  // ผู้เช่าเห็นเฉพาะบิลของตัวเอง (rule #7)
  async listForTenantUser(userId: number, query: ListQuery, filters: InvoiceFilters) {
    const tenant = await tenantRepository.findByUserId(userId);
    if (!tenant) throw new ApiError(404, "TENANT_NOT_FOUND", "ไม่พบข้อมูลผู้เช่า");
    // ผู้เช่าไม่เห็นบิล DRAFT (ยังไม่ได้ออกบิลอย่างเป็นทางการ)
    if (filters.status === "DRAFT") return paginatedResult([], 0, query);
    const { items, total } = await invoiceRepository.findMany(query, {
      ...filters,
      tenantId: tenant.id,
      excludeDraft: true,
    });
    return paginatedResult(items, total, query);
  },

  async getByIdForTenantUser(id: number, userId: number) {
    const tenant = await tenantRepository.findByUserId(userId);
    const invoice = await this.getById(id);
    if (!tenant || invoice.contract.tenantId !== tenant.id || invoice.status === "DRAFT") {
      throw new ApiError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้");
    }
    return invoice;
  },

  async create(input: CreateInvoiceInput) {
    const contract = await contractRepository.findById(input.contractId);
    if (!contract) throw new ApiError(404, "CONTRACT_NOT_FOUND", "ไม่พบสัญญาเช่านี้");
    if (contract.status !== "ACTIVE") {
      throw new ApiError(400, "NO_ACTIVE_CONTRACT", "สัญญานี้ไม่ Active ไม่สามารถสร้างบิลได้");
    }
    if (input.billingMonth < monthStartUTC(contract.startDate)) {
      throw new ApiError(400, "BILLING_BEFORE_CONTRACT", "เดือนที่ออกบิลอยู่ก่อนวันเริ่มสัญญา");
    }

    const duplicate = await invoiceRepository.findByContractAndMonth(contract.id, input.billingMonth);
    if (duplicate) {
      throw new ApiError(409, "INVOICE_ALREADY_EXISTS", "มีบิลของเดือนนี้สำหรับสัญญานี้แล้ว");
    }

    const [water, electricity] = await Promise.all([
      meterService.monthlyCharge("water", contract.roomId, input.billingMonth),
      meterService.monthlyCharge("electricity", contract.roomId, input.billingMonth),
    ]);

    const rent = Number(contract.room.monthlyRent);
    const otherCharges = sum(input.otherCharges);
    const total = calculateTotalInvoice({
      rent,
      water: water.total,
      electricity: electricity.total,
      otherCharges,
      discount: input.discount,
      fine: 0,
    });
    if (total < 0) throw new ApiError(400, "INVALID_TOTAL", "ส่วนลดมากกว่ายอดรวมของบิล");

    const sequence = (await invoiceRepository.countForMonth(input.billingMonth)) + 1;

    const invoice = await invoiceRepository.create({
      invoiceNumber: generateInvoiceNumber(input.billingMonth, sequence),
      contractId: contract.id,
      billingMonth: input.billingMonth,
      rent,
      water: water.total,
      electricity: electricity.total,
      otherCharges,
      discount: input.discount,
      fine: 0,
      total,
      dueDate: input.dueDate ?? defaultDueDate(input.billingMonth),
      status: input.issue ? "ISSUED" : "DRAFT",
      items: buildItems({ rent, water, electricity, otherCharges: input.otherCharges, discount: input.discount }),
    });

    return { invoice, missingReadings: { water: !water.recorded, electricity: !electricity.recorded } };
  },

  // แก้ไขได้เฉพาะบิล DRAFT (ค่าเช่า/น้ำ/ไฟ ดึงจากข้อมูลจริงใหม่ทุกครั้งที่บันทึก)
  async update(id: number, input: UpdateInvoiceInput) {
    const invoice = await this.getById(id);
    if (invoice.status !== "DRAFT") {
      throw new ApiError(409, "INVOICE_NOT_EDITABLE", "แก้ไขได้เฉพาะบิลสถานะ DRAFT");
    }

    const otherCharges = input.otherCharges ?? invoice.items
      .filter((i) => !["ค่าเช่าห้อง", "ส่วนลด"].includes(i.label) && !/^ค่า(น้ำ|ไฟ)/.test(i.label))
      .map((i) => ({ label: i.label, amount: Number(i.amount) }));
    const discount = input.discount ?? Number(invoice.discount);

    const [water, electricity] = await Promise.all([
      meterService.monthlyCharge("water", invoice.contract.roomId, invoice.billingMonth),
      meterService.monthlyCharge("electricity", invoice.contract.roomId, invoice.billingMonth),
    ]);

    const rent = Number(invoice.rent);
    const otherTotal = sum(otherCharges);
    const total = calculateTotalInvoice({
      rent,
      water: water.total,
      electricity: electricity.total,
      otherCharges: otherTotal,
      discount,
      fine: 0,
    });
    if (total < 0) throw new ApiError(400, "INVALID_TOTAL", "ส่วนลดมากกว่ายอดรวมของบิล");

    return invoiceRepository.replaceContent(id, {
      otherCharges: otherTotal,
      discount,
      total,
      dueDate: input.dueDate ?? invoice.dueDate,
      items: buildItems({ rent, water, electricity, otherCharges, discount }),
    });
  },

  async issue(id: number) {
    const invoice = await this.getById(id);
    if (invoice.status !== "DRAFT") {
      throw new ApiError(409, "INVOICE_NOT_DRAFT", "ออกบิลได้เฉพาะบิลสถานะ DRAFT");
    }
    return invoiceRepository.updateStatus(id, "ISSUED");
  },

  async cancel(id: number) {
    const invoice = await this.getById(id);
    if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
      throw new ApiError(409, "INVOICE_NOT_CANCELLABLE", `ไม่สามารถยกเลิกบิลสถานะ ${invoice.status} ได้`);
    }
    if ((await invoiceRepository.countApprovedPayments(id)) > 0) {
      throw new ApiError(409, "INVOICE_HAS_PAYMENT", "บิลนี้มีการชำระเงินที่อนุมัติแล้ว ไม่สามารถยกเลิกได้");
    }
    return invoiceRepository.updateStatus(id, "CANCELLED");
  },

  // ออกบิลของทุกสัญญา Active ในเดือนที่ระบุ (ข้ามสัญญาที่มีบิลแล้ว) — บิลที่สร้างมีสถานะ ISSUED
  async generateMonthly(billingMonth: Date) {
    const contracts = await invoiceRepository.findActiveContractsForBilling();
    const created: string[] = [];
    const skipped: { contractId: number; roomNumber: string; reason: string }[] = [];
    const missingReadings: { roomNumber: string; water: boolean; electricity: boolean }[] = [];

    for (const contract of contracts) {
      try {
        const { invoice, missingReadings: missing } = await this.create({
          contractId: contract.id,
          billingMonth,
          otherCharges: [],
          discount: 0,
          issue: true,
        });
        created.push(invoice.invoiceNumber);
        if (missing.water || missing.electricity) {
          missingReadings.push({ roomNumber: contract.room.roomNumber, ...missing });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          skipped.push({ contractId: contract.id, roomNumber: contract.room.roomNumber, reason: err.message });
        } else {
          throw err;
        }
      }
    }

    return { billingMonth, createdCount: created.length, created, skipped, missingReadings };
  },

  // Job ประจำวัน: บิลที่เลยกำหนด -> OVERDUE และคำนวณค่าปรับสะสมใหม่ (สูตรใน calculateLateFee)
  // คิดจากยอดก่อนค่าปรับเสมอ จึงรันซ้ำกี่ครั้งก็ได้ผลเท่าเดิม (idempotent)
  async applyOverdueAndFines(now: Date = new Date()) {
    const pastDue = await invoiceRepository.findPastDue(now);
    let updated = 0;

    for (const invoice of pastDue) {
      const baseTotal = calculateTotalInvoice({
        rent: Number(invoice.rent),
        water: Number(invoice.water),
        electricity: Number(invoice.electricity),
        otherCharges: Number(invoice.otherCharges),
        discount: Number(invoice.discount),
        fine: 0,
      });
      const fine = calculateLateFee(baseTotal, diffInDays(now, invoice.dueDate));
      const status = invoice.status === "PARTIAL" ? "PARTIAL" : "OVERDUE";

      if (fine !== Number(invoice.fine) || status !== invoice.status) {
        await invoiceRepository.updateFine(invoice.id, fine, calculateTotalInvoice({
          rent: Number(invoice.rent),
          water: Number(invoice.water),
          electricity: Number(invoice.electricity),
          otherCharges: Number(invoice.otherCharges),
          discount: Number(invoice.discount),
          fine,
        }), status);
        updated++;
      }
    }

    return { checked: pastDue.length, updated };
  },

  currentMonth: currentBillingMonth,
  previousMonth: previousBillingMonth,
};
