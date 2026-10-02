import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository layer สำหรับ Rental Contract (spec ข้อ 7)

const contractInclude = {
  room: true,
  tenant: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
};

export const contractRepository = {
  async findMany(query: ListQuery, filters: { tenantId?: number; roomId?: number; status?: string }) {
    const where: Prisma.RentalContractWhereInput = {
      deletedAt: null,
      ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.status ? { status: filters.status as Prisma.EnumContractStatusFilter["equals"] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.rentalContract.findMany({
        where,
        include: contractInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { id: query.sortOrder },
      }),
      prisma.rentalContract.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: number) {
    return prisma.rentalContract.findFirst({ where: { id, deletedAt: null }, include: contractInclude });
  },

  findActiveByRoomId(roomId: number) {
    return prisma.rentalContract.findFirst({ where: { roomId, status: "ACTIVE", deletedAt: null } });
  },

  findActiveByTenantId(tenantId: number) {
    return prisma.rentalContract.findFirst({ where: { tenantId, status: "ACTIVE", deletedAt: null } });
  },

  create(data: Prisma.RentalContractCreateInput) {
    return prisma.rentalContract.create({ data, include: contractInclude });
  },

  update(id: number, data: Prisma.RentalContractUpdateInput) {
    return prisma.rentalContract.update({ where: { id }, data, include: contractInclude });
  },

  setPdfPath(id: number, pdfFilePath: string) {
    return prisma.rentalContract.update({ where: { id }, data: { pdfFilePath } });
  },

  // สัญญาที่ใกล้หมดอายุใน N วันข้างหน้า ใช้สำหรับ Notification (spec ข้อ 7, 19)
  findExpiringWithin(days: number) {
    const now = new Date();
    const target = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return prisma.rentalContract.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lte: target }, deletedAt: null },
      include: contractInclude,
    });
  },
};
