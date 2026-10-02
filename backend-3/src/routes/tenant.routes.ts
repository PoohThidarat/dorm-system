import { Router } from "express";
import { tenantController } from "../controllers/tenant.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: กำหนด route ของ /api/tenants (spec ข้อ 6, 26)

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));

router.get("/", asyncHandler(tenantController.list));
router.post("/", asyncHandler(tenantController.create));
router.get("/:id", asyncHandler(tenantController.getById));
router.put("/:id", asyncHandler(tenantController.update));
router.post("/:id/move-room", asyncHandler(tenantController.moveRoom));
router.post("/:id/cancel-rental", asyncHandler(tenantController.cancelRental));
router.delete("/:id", asyncHandler(tenantController.remove));

export default router;
