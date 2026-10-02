import { Prisma, RoomStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ListQuery } from "../utils/pagination";

// หน้าที่ของไฟล์: Repository layer สำหรับ Room และ RoomType - จุดเดียวที่คุยกับ Prisma

const ROOM_SORTABLE = ["id", "roomNumber", "floor", "monthlyRent", "createdAt"];

export interface RoomListFilters {
  status?: RoomStatus;
  roomTypeId?: number;
}

export const roomRepository = {
  async findMany(query: ListQuery, filters: RoomListFilters) {
    const where: Prisma.RoomWhereInput = {
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.roomTypeId ? { roomTypeId: filters.roomTypeId } : {}),
      ...(query.search
        ? {
            OR: [
              { roomNumber: { contains: query.search } },
              { description: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: { roomType: true },
        orderBy: {
          [ROOM_SORTABLE.includes(query.sortBy ?? "") ? (query.sortBy as string) : "id"]: query.sortOrder,
        },
        skip: query.skip,
        take: query.take,
      }),
      prisma.room.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: number) {
    return prisma.room.findFirst({
      where: { id, deletedAt: null },
      include: { roomType: true },
    });
  },

  findByRoomNumber(roomNumber: string) {
    return prisma.room.findFirst({ where: { roomNumber, deletedAt: null } });
  },

  create(data: Prisma.RoomCreateInput) {
    return prisma.room.create({ data, include: { roomType: true } });
  },

  update(id: number, data: Prisma.RoomUpdateInput) {
    return prisma.room.update({ where: { id }, data, include: { roomType: true } });
  },

  softDelete(id: number) {
    return prisma.room.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  countActiveContractsForRoom(roomId: number) {
    return prisma.rentalContract.count({
      where: { roomId, status: "ACTIVE" },
    });
  },

  summary() {
    return prisma.room.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
  },
};

export const roomTypeRepository = {
  findAll() {
    return prisma.roomType.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: number) {
    return prisma.roomType.findUnique({ where: { id } });
  },

  findByName(name: string) {
    return prisma.roomType.findUnique({ where: { name } });
  },

  create(name: string) {
    return prisma.roomType.create({ data: { name } });
  },
};
