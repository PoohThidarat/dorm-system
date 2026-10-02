import { Router } from "express";
import { contractController } from "../controllers/contract.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { uploadContractPdf } from "../middlewares/upload.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: กำหนด route ของ /api/contracts (spec ข้อ 7, 26)

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));

router.get("/", asyncHandler(contractController.list));
router.post("/", asyncHandler(contractController.create));
router.get("/:id", asyncHandler(contractController.getById));
router.put("/:id", asyncHandler(contractController.update));
router.post("/:id/terminate", asyncHandler(contractController.terminate));
router.post("/:id/pdf", uploadContractPdf.single("file"), asyncHandler(contractController.uploadPdf));

export default router;
