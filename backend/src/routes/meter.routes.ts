import { Router } from "express";
import { meterController } from "../controllers/meter.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: route ของ /api/meters/:kind/* (kind = water | electricity)
// Admin จัดการได้ทั้งหมด, Tenant ดูได้เฉพาะประวัติของตัวเองผ่าน /my/:kind/readings

const router = Router();
const adminOnly = [authenticate, requireRole("SUPER_ADMIN", "ADMIN")];

router.get("/my/:kind/readings", authenticate, requireRole("TENANT"), asyncHandler(meterController.myHistory));

router.get("/:kind/readings", ...adminOnly, asyncHandler(meterController.history));
router.post("/:kind/readings", ...adminOnly, asyncHandler(meterController.record));
router.get("/:kind/latest", ...adminOnly, asyncHandler(meterController.latest));
router.put("/:kind/rooms/:roomId/price", ...adminOnly, asyncHandler(meterController.setPrice));

export default router;
