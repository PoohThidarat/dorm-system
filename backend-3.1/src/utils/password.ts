import bcrypt from "bcrypt";

// หน้าที่ของไฟล์: จัดการ Hash / Verify รหัสผ่านด้วย bcrypt
// ห้ามเก็บ Password แบบ Plain Text ที่ไหนในระบบ (spec ข้อ 24)

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
