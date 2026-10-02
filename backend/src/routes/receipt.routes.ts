import { Router } from "express";
import { receiptController } from "../controllers/receipt.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: route ของ /api/receipts (spec ข้อ 12, 26)

const router = Router();

router.get("/my", authenticate, requireRole("TENANT"), asyncHandler(receiptController.listMine));
router.get("/", authenticate, requireRole("SUPER_ADMIN", "ADMIN"), asyncHandler(receiptController.list));

router.get("/:id", authenticate, requireRole("SUPER_ADMIN", "ADMIN", "TENANT"), asyncHandler(receiptController.getById));
router.get("/:id/pdf", authenticate, requireRole("SUPER_ADMIN", "ADMIN", "TENANT"), asyncHandler(receiptController.pdf));

export default router;
