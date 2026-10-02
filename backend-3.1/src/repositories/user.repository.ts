import { prisma } from "../config/prisma";

// หน้าที่ของไฟล์: Repository layer - จุดเดียวที่คุยกับ Prisma สำหรับข้อมูล User/Role
// Service layer ไม่ควร import prisma ตรง ๆ ให้เรียกผ่านที่นี่เท่านั้น (Layered Architecture, spec ข้อ 35)

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { role: true },
    });
  },

  findById(id: number) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { role: true },
    });
  },

  findByResetToken(token: string) {
    return prisma.user.findFirst({
      where: { resetPasswordToken: token, deletedAt: null },
    });
  },

  findRoleByName(roleName: string) {
    return prisma.role.findUnique({ where: { name: roleName } });
  },

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleId: number;
  }) {
    return prisma.user.create({ data, include: { role: true } });
  },

  setRefreshTokenHash(userId: number, refreshTokenHash: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  },

  setResetToken(userId: number, token: string | null, expiresAt: Date | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { resetPasswordToken: token, resetPasswordExpiresAt: expiresAt },
    });
  },

  updatePassword(userId: number, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });
  },
};
