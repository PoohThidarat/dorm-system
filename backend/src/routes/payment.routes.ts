import { Router } from "express";
import { paymentController } from "../controllers/payment.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { uploadPaymentSlip } from "../middlewares/upload.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: route ของ /api/payments (spec ข้อ 11, 26)
// ลำดับสำคัญ: path ตายตัว (/my, /record) ต้องอยู่ก่อน /:id

const router = Router();
const adminOnly = [authenticate, requireRole("SUPER_ADMIN", "ADMIN")];
const tenantOnly = [authenticate, requireRole("TENANT")];
const adminOrTenant = [authenticate, requireRole("SUPER_ADMIN", "ADMIN", "TENANT")];

router.get("/my", ...tenantOnly, asyncHandler(paymentController.listMine));
router.post("/", ...tenantOnly, uploadPaymentSlip.single("slip"), asyncHandler(paymentController.submit));

router.get("/", ...adminOnly, asyncHandler(paymentController.list));
router.post("/record", ...adminOnly, asyncHandler(paymentController.record));

// Admin หรือเจ้าของรายการเท่านั้น — service ตรวจความเป็นเจ้าของอีกชั้น
router.get("/:id", ...adminOrTenant, asyncHandler(paymentController.getById));
router.get("/:id/slip", ...adminOrTenant, asyncHandler(paymentController.slip));

router.post("/:id/approve", ...adminOnly, asyncHandler(paymentController.approve));
router.post("/:id/reject", ...adminOnly, asyncHandler(paymentController.reject));

export default router;
