import { Prisma, TenantStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository layer สำหรับ Tenant (spec ข้อ 6)
// ข้อมูลผู้เช่าผูกกับ User เสมอ (1-to-1) เพื่อให้ผู้เช่า login เข้าระบบได้

export interface TenantListFilters {
  status?: TenantStatus;
}

const tenantInclude = {
  user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true, isActive: true } },
  contracts: {
    where: { status: "ACTIVE" as const },
    include: { room: true },
    take: 1,
    orderBy: { startDate: "desc" as const },
  },
};

export const tenantRepository = {
  async findMany(query: ListQuery, filters: TenantListFilters) {
    const where: Prisma.TenantWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(query.search
        ? {
            OR: [
              { nationalId: { contains: query.search } },
              { user: { firstName: { contains: query.search } } },
              { user: { lastName: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        include: tenantInclude,
        skip: query.skip,
        take: query.take,
        orderBy: { id: query.sortOrder },
      }),
      prisma.tenant.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: number) {
    return prisma.tenant.findFirst({ where: { id, deletedAt: null }, include: tenantInclude });
  },

  findByUserId(userId: number) {
    return prisma.tenant.findFirst({ where: { userId, deletedAt: null }, include: tenantInclude });
  },

  findByNationalId(nationalId: string) {
    return prisma.tenant.findFirst({ where: { nationalId, deletedAt: null } });
  },

  createWithUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleId: number;
    nationalId: string;
    address?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          roleId: data.roleId,
        },
      });

      return tx.tenant.create({
        data: {
          userId: user.id,
          nationalId: data.nationalId,
          address: data.address,
        },
        include: tenantInclude,
      });
    });
  },

  async update(id: number, data: { firstName?: string; lastName?: string; phone?: string; address?: string }) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id } });

    return prisma.$transaction(async (tx) => {
      if (data.firstName || data.lastName || data.phone) {
        await tx.user.update({
          where: { id: tenant.userId },
          data: {
            ...(data.firstName ? { firstName: data.firstName } : {}),
            ...(data.lastName ? { lastName: data.lastName } : {}),
            ...(data.phone ? { phone: data.phone } : {}),
          },
        });
      }

      return tx.tenant.update({
        where: { id },
        data: { ...(data.address !== undefined ? { address: data.address } : {}) },
        include: tenantInclude,
      });
    });
  },

  setStatus(id: number, status: TenantStatus) {
    return prisma.tenant.update({ where: { id }, data: { status } });
  },

  softDelete(id: number) {
    return prisma.tenant.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
