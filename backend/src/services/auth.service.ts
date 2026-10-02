import crypto from "crypto";
import { userRepository } from "../repositories/user.repository";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { ApiError } from "../utils/apiResponse";
import { RegisterInput } from "../validators/auth.validator";

// หน้าที่ของไฟล์: Business logic ของระบบ Authentication ทั้งหมด
// Controller เรียกใช้ฟังก์ชันในนี้เท่านั้น ห้ามคุยกับ repository ตรง ๆ

async function issueTokens(userId: number, roleName: string) {
  const payload = { userId, role: roleName };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // เก็บ hash ของ refresh token แทนตัวจริง เพื่อรองรับการ revoke ตอน logout
  const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  await userRepository.setRefreshTokenHash(userId, refreshTokenHash);

  return { accessToken, refreshToken };
}

export const authService = {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    const tokens = await issueTokens(user.id, user.role.name);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
      },
    };
  },

  async register(input: RegisterInput) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw new ApiError(409, "EMAIL_ALREADY_EXISTS", "อีเมลนี้ถูกใช้งานแล้ว");
    }

    const role = await userRepository.findRoleByName(input.roleName);
    if (!role) {
      throw new ApiError(400, "ROLE_NOT_FOUND", "ไม่พบ Role ที่ระบุ");
    }

    const passwordHash = await hashPassword(input.password);

    const user = await userRepository.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      roleId: role.id,
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role.name,
    };
  },

  async refresh(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new ApiError(401, "TOKEN_INVALID", "Refresh token ไม่ถูกต้องหรือหมดอายุ");
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || !user.refreshTokenHash) {
      throw new ApiError(401, "TOKEN_INVALID", "Refresh token ไม่ถูกต้อง");
    }

    const incomingHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    if (incomingHash !== user.refreshTokenHash) {
      // Refresh token ถูกใช้ซ้ำ/ถูกเพิกถอนแล้ว -> revoke ทั้งหมดเพื่อความปลอดภัย
      await userRepository.setRefreshTokenHash(user.id, null);
      throw new ApiError(401, "TOKEN_REUSED", "กรุณาเข้าสู่ระบบใหม่");
    }

    return issueTokens(user.id, user.role.name);
  },

  async logout(userId: number) {
    await userRepository.setRefreshTokenHash(userId, null);
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    // ไม่เปิดเผยว่าอีเมลมีอยู่ในระบบหรือไม่ (ป้องกัน user enumeration)
    if (!user) return;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 นาที
    await userRepository.setResetToken(user.id, token, expiresAt);

    // TODO Phase 6: ส่ง token ผ่าน Email/LINE แทนการ return ตรง ๆ
    return token;
  },

  async resetPassword(token: string, newPassword: string) {
    const user = await userRepository.findByResetToken(token);
    if (!user || !user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < new Date()) {
      throw new ApiError(400, "RESET_TOKEN_INVALID", "ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุ");
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePassword(user.id, passwordHash);
    await userRepository.setRefreshTokenHash(user.id, null); // บังคับ login ใหม่ทุก session
  },

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้งาน");
    }

    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) {
      throw new ApiError(400, "CURRENT_PASSWORD_INCORRECT", "รหัสผ่านปัจจุบันไม่ถูกต้อง");
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePassword(user.id, passwordHash);
  },
};
