import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository ของใบเสร็จ (spec ข้อ 12)
// ใบเสร็จสร้างจาก Payment ที่ APPROVED เท่านั้น (rule #6) — การสร้างอยู่ใน paymentRepository.approveWithReceipt

const receiptInclude = {
  payment: {
    include: {
      invoice: {
        include: {
          items: true,
          contract: {
            include: {
              room: { select: { id: true, roomNumber: true } },
              tenant: {
                select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
    },
  },
};

const SORTABLE = ["id", "issuedAt", "receiptNumber"];

export interface ReceiptFilters {
  tenantId?: number;
}

export const receiptRepository = {
  async findMany(query: ListQuery, filters: ReceiptFilters) {
    const where: Prisma.ReceiptWhereInput = {
      ...(filters.tenantId ? { payment: { invoice: { contract: { tenantId: filters.tenantId } } } } : {}),
      ...(query.search
        ? {
            OR: [
              { receiptNumber: { contains: query.search } },
              { payment: { invoice: { invoiceNumber: { contains: query.search } } } },
              { payment: { invoice: { contract: { room: { roomNumber: { contains: query.search } } } } } },
              { payment: { invoice: { contract: { tenant: { user: { firstName: { contains: query.search } } } } } } },
            ],
          }
        : {}),
    };
    const sortBy = SORTABLE.includes(query.sortBy ?? "") ? (query.sortBy as string) : "id";

    const [items, total] = await Promise.all([
      prisma.receipt.findMany({
        where,
        include: receiptInclude,
        orderBy: { [sortBy]: query.sortOrder },
        skip: query.skip,
        take: query.take,
      }),
      prisma.receipt.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: number) {
    return prisma.receipt.findUnique({ where: { id }, include: receiptInclude });
  },

  setPdfPath(id: number, pdfFilePath: string) {
    return prisma.receipt.update({ where: { id }, data: { pdfFilePath } });
  },

  // ยอดที่ชำระสะสมถึงและรวมใบเสร็จนี้ (ใช้แสดง "คงเหลือ" ในใบเสร็จ PDF)
  async sumApprovedUpTo(invoiceId: number, receiptId: number): Promise<number> {
    const result = await prisma.payment.aggregate({
      where: { invoiceId, status: "APPROVED", receipt: { id: { lte: receiptId } } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },
};
