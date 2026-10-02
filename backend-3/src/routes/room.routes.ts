import { Router } from "express";
import { roomController, roomTypeController } from "../controllers/room.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: กำหนด route ของ /api/rooms และ /api/room-types (spec ข้อ 5, 26)
// เฉพาะ SUPER_ADMIN / ADMIN เท่านั้นที่จัดการห้องพักได้

const router = Router();

router.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));

router.get("/summary", asyncHandler(roomController.dashboardSummary));
router.get("/", asyncHandler(roomController.list));
router.post("/", asyncHandler(roomController.create));
router.get("/:id", asyncHandler(roomController.getById));
router.put("/:id", asyncHandler(roomController.update));
router.patch("/:id/status", asyncHandler(roomController.changeStatus));
router.delete("/:id", asyncHandler(roomController.remove));

export const roomTypeRouter = Router();
roomTypeRouter.use(authenticate, requireRole("SUPER_ADMIN", "ADMIN"));
roomTypeRouter.get("/", asyncHandler(roomTypeController.list));
roomTypeRouter.post("/", asyncHandler(roomTypeController.create));

export default router;
