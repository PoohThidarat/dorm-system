import { Router } from "express";
import { invoiceController } from "../controllers/invoice.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: route ของ /api/invoices (spec ข้อ 8, 26)

const router = Router();
const adminOnly = [authenticate, requireRole("SUPER_ADMIN", "ADMIN")];

router.get("/my", authenticate, requireRole("TENANT"), asyncHandler(invoiceController.listMine));

router.get("/", ...adminOnly, asyncHandler(invoiceController.list));
router.post("/", ...adminOnly, asyncHandler(invoiceController.create));
router.post("/generate-monthly", ...adminOnly, asyncHandler(invoiceController.generateMonthly));

// Admin และ Tenant เรียกได้ — controller ตรวจความเป็นเจ้าของบิลของ Tenant เอง
router.get("/:id", authenticate, requireRole("SUPER_ADMIN", "ADMIN", "TENANT"), asyncHandler(invoiceController.getById));

router.put("/:id", ...adminOnly, asyncHandler(invoiceController.update));
router.post("/:id/issue", ...adminOnly, asyncHandler(invoiceController.issue));
router.post("/:id/cancel", ...adminOnly, asyncHandler(invoiceController.cancel));

export default router;
