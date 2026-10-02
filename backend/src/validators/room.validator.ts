import { z } from "zod";

// หน้าที่ของไฟล์: ตรวจสอบ input ของ Room Management (spec ข้อ 5, 30)

export const roomStatusEnum = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "MAINTENANCE",
  "INACTIVE",
]);

export const createRoomSchema = z.object({
  roomNumber: z.string().min(1, "กรุณาระบุเลขห้อง"),
  floor: z.number().int().min(0),
  roomTypeId: z.number().int().positive("กรุณาเลือกประเภทห้อง"),
  monthlyRent: z.number().positive("ค่าเช่าต้องเป็นตัวเลขมากกว่า 0"),
  deposit: z.number().nonnegative("เงินประกันต้องไม่ติดลบ"),
  description: z.string().optional(),
  images: z.array(z.string()).optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const changeRoomStatusSchema = z.object({
  status: roomStatusEnum,
});

export const createRoomTypeSchema = z.object({
  name: z.string().min(1, "กรุณาระบุชื่อประเภทห้อง"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
