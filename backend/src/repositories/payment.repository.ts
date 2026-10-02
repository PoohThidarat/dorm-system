import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiResponse";
import {
  exceedsBalance,
  generateReceiptNumber,
  receiptNumberPrefix,
  statusAfterPayment,
} from "../utils/billing.util";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository ของ Payment / PaymentSlip (spec ข้อ 11)
// รวมถึง transaction "อนุมัติการชำระ" ที่ต้องทำหลายอย่างพร้อมกันแบบ atomic:
//   payment -> APPROVED, สร้าง Receipt (rule #6), อัปเดตสถานะบิล PAID/PARTIAL

const paymentInclude = {
  slips: true,
  receipt: { select: { id: true, receiptNumber: true } },
  invoice: {
    select: {
      id: true,
      invoiceNumber: true,
      billingMonth: true,
      total: true,
      status: true,
      contract: {
        select: {
          tenantId: true,
          room: { select: { id: true, roomNumber: true } },
          tenant: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  },
};

const SORTABLE = ["id", "paymentDate", "amount", "status", "createdAt"];

export interface PaymentFilters {
  status?: PaymentStatus;
  invoiceId?: number;
  tenantId?: number;
}

export interface NewPaymentData {
  invoiceId: number;
  amount: number;
  method: PaymentMethod;
  paymentDate: Date;
  referenceNumber?: string;
  slipPath?: string;
}

export const PAYABLE_INVOICE_STATUSES = ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"];

export const paymentRepository = {
  async findMany(query: ListQuery, filters: PaymentFilters) {
    const where: Prisma.PaymentWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.invoiceId ? { invoiceId: filters.invoiceId } : {}),
      ...(filters.tenantId ? { invoice: { contract: { tenantId: filters.tenantId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceNumber: { contains: query.search } },
              { invoice: { invoiceNumber: { contains: query.search } } },
              { invoice: { contract: { room: { roomNumber: { contains: query.search } } } } },
              { invoice: { contract: { tenant: { user: { firstName: { contains: query.search } } } } } },
              { invoice: { contract: { tenant: { user: { lastName: { contains: query.search } } } } } },
            ],
          }
        : {}),
    };
    const sortBy = SORTABLE.includes(query.sortBy ?? "") ? (query.sortBy as string) : "id";

    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { [sortBy]: query.sortOrder },
        skip: query.skip,
        take: query.take,
      }),
      prisma.payment.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: number) {
    return prisma.payment.findUnique({ where: { id }, include: paymentInclude });
  },

  create(data: NewPaymentData) {
    const { slipPath, ...fields } = data;
    return prisma.payment.create({
      data: { ...fields, ...(slipPath ? { slips: { create: [{ filePath: slipPath }] } } : {}) },
      include: paymentInclude,
    });
  },

  delete(id: number) {
    return prisma.$transaction([
      prisma.paymentSlip.deleteMany({ where: { paymentId: id } }),
      prisma.payment.delete({ where: { id } }),
    ]);
  },

  findPendingByInvoice(invoiceId: number) {
    return prisma.payment.findFirst({ where: { invoiceId, status: "PENDING" } });
  },

  // เลขอ้างอิงการโอนที่ยังใช้งานอยู่ (ไม่ถูกปฏิเสธ) — กันใช้สลิปเดียวแจ้งซ้ำ
  findActiveByReference(referenceNumber: string) {
    return prisma.payment.findFirst({
      where: { referenceNumber, status: { in: ["PENDING", "APPROVED"] } },
    });
  },

  async sumApproved(invoiceId: number): Promise<number> {
    const result = await prisma.payment.aggregate({
      where: { invoiceId, status: "APPROVED" },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },

  async reject(id: number, reviewerId: number, reason: string) {
    // updateMany + เงื่อนไข status ป้องกันสองคนกดพร้อมกัน (อนุมัติ/ปฏิเสธซ้ำ)
    const result = await prisma.payment.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", rejectReason: reason, reviewedById: reviewerId, reviewedAt: new Date() },
    });
    if (result.count === 0) {
      throw new ApiError(409, "PAYMENT_NOT_PENDING", "รายการนี้ถูกดำเนินการไปแล้ว");
    }
    return prisma.payment.findUniqueOrThrow({ where: { id }, include: paymentInclude });
  },

  // อนุมัติ + ออกใบเสร็จ + อัปเดตสถานะบิล ใน transaction เดียว
  // ล็อกแถวบิล (FOR UPDATE) เพื่อให้การอนุมัติหลายรายการของบิลเดียวกันเรียงคิวกัน ไม่คิดยอดสะสมผิด
  approveWithReceipt(paymentId: number, reviewerId: number, now: Date = new Date()) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "ไม่พบรายการชำระเงินนี้");

      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId} FOR UPDATE`;

      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: reviewerId, reviewedAt: now },
      });
      if (claimed.count === 0) {
        throw new ApiError(409, "PAYMENT_NOT_PENDING", "รายการนี้ถูกดำเนินการไปแล้ว");
      }

      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
      if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
        throw new ApiError(409, "INVOICE_NOT_PAYABLE", `บิลสถานะ ${invoice.status} ไม่สามารถรับชำระได้`);
      }

      const paidBefore = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: "APPROVED", id: { not: paymentId } },
        _sum: { amount: true },
      });
      const paidBeforeAmount = Number(paidBefore._sum.amount ?? 0);
      const remaining = Number(invoice.total) - paidBeforeAmount;
      if (exceedsBalance(Number(payment.amount), remaining)) {
        throw new ApiError(
          409,
          "OVERPAYMENT",
          `ยอดชำระ (${Number(payment.amount)}) เกินยอดคงเหลือของบิล (${remaining}) กรุณาปฏิเสธรายการนี้`,
        );
      }

      // เลขใบเสร็จ = ลำดับถัดไปของเดือน (unique ใน DB กันซ้ำ; service จะ retry ถ้าชนกัน)
      const prefix = receiptNumberPrefix(now);
      const last = await tx.receipt.findFirst({
        where: { receiptNumber: { startsWith: prefix } },
        orderBy: { receiptNumber: "desc" },
      });
      const lastSequence = last ? Number(last.receiptNumber.slice(prefix.length)) : 0;

      const receipt = await tx.receipt.create({
        data: { receiptNumber: generateReceiptNumber(now, lastSequence + 1), paymentId, issuedAt: now },
      });

      const newStatus = statusAfterPayment(Number(invoice.total), paidBeforeAmount + Number(payment.amount));
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: newStatus } });

      const approved = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: paymentInclude });
      return { payment: approved, receipt, invoiceStatus: newStatus };
    });
  },
};
