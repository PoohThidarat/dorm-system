import { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository ของ Invoice และ InvoiceItem (spec ข้อ 8)

const invoiceInclude = {
  items: true,
  contract: {
    include: {
      room: { select: { id: true, roomNumber: true } },
      tenant: {
        select: {
          id: true,
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
};

const SORTABLE = ["id", "billingMonth", "total", "dueDate", "status", "invoiceNumber"];

export interface InvoiceFilters {
  status?: InvoiceStatus;
  billingMonth?: Date;
  contractId?: number;
  tenantId?: number;
  excludeDraft?: boolean; // ผู้เช่าไม่เห็นบิลร่าง
}

export interface NewInvoiceData {
  invoiceNumber: string;
  contractId: number;
  billingMonth: Date;
  rent: number;
  water: number;
  electricity: number;
  otherCharges: number;
  discount: number;
  fine: number;
  total: number;
  dueDate: Date;
  status: InvoiceStatus;
  items: { label: string; amount: number }[];
}

export const invoiceRepository = {
  async findMany(query: ListQuery, filters: InvoiceFilters) {
    const where: Prisma.InvoiceWhereInput = {
      ...(filters.status
        ? { status: filters.status }
        : filters.excludeDraft
          ? { status: { not: "DRAFT" as const } }
          : {}),
      ...(filters.billingMonth ? { billingMonth: filters.billingMonth } : {}),
      ...(filters.contractId ? { contractId: filters.contractId } : {}),
      ...(filters.tenantId ? { contract: { tenantId: filters.tenantId } } : {}),
      ...(query.search
        ? {
            OR: [
              { invoiceNumber: { contains: query.search } },
              { contract: { room: { roomNumber: { contains: query.search } } } },
              { contract: { tenant: { user: { firstName: { contains: query.search } } } } },
              { contract: { tenant: { user: { lastName: { contains: query.search } } } } },
            ],
          }
        : {}),
    };

    const sortBy = SORTABLE.includes(query.sortBy ?? "") ? (query.sortBy as string) : "id";

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { [sortBy]: query.sortOrder },
        skip: query.skip,
        take: query.take,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: number) {
    return prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  },

  findByContractAndMonth(contractId: number, billingMonth: Date) {
    return prisma.invoice.findUnique({
      where: { contractId_billingMonth: { contractId, billingMonth } },
    });
  },

  countForMonth(billingMonth: Date) {
    return prisma.invoice.count({ where: { billingMonth } });
  },

  create(data: NewInvoiceData) {
    const { items, ...invoice } = data;
    return prisma.invoice.create({
      data: { ...invoice, items: { create: items } },
      include: invoiceInclude,
    });
  },

  // แก้ไขบิล DRAFT: ลบรายการเดิมแล้วสร้างใหม่ทั้งชุด ให้ยอดรวมกับรายการตรงกันเสมอ
  replaceContent(
    id: number,
    data: {
      otherCharges: number;
      discount: number;
      total: number;
      dueDate: Date;
      items: { label: string; amount: number }[];
    },
  ) {
    const { items, ...fields } = data;
    return prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: { ...fields, items: { create: items } },
        include: invoiceInclude,
      });
    });
  },

  updateStatus(id: number, status: InvoiceStatus) {
    return prisma.invoice.update({ where: { id }, data: { status }, include: invoiceInclude });
  },

  updateFine(id: number, fine: number, total: number, status: InvoiceStatus) {
    return prisma.invoice.update({ where: { id }, data: { fine, total, status } });
  },

  // บิลที่ค้างชำระและเลยกำหนดแล้ว ใช้ใน job คำนวณค่าปรับรายวัน
  findPastDue(now: Date) {
    return prisma.invoice.findMany({
      where: {
        status: { in: ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"] },
        dueDate: { lt: now },
      },
    });
  },

  countApprovedPayments(invoiceId: number) {
    return prisma.payment.count({ where: { invoiceId, status: "APPROVED" } });
  },

  // สัญญา Active ทั้งหมด ใช้ตอนออกบิลรายเดือน
  findActiveContractsForBilling() {
    return prisma.rentalContract.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      include: { room: true },
      orderBy: { id: "asc" },
    });
  },
};
