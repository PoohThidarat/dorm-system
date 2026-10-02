import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/rbac.middleware";
import { asyncHandler } from "../utils/asyncHandler";

// หน้าที่ของไฟล์: กำหนด route ของ /api/auth/* ตาม API spec ข้อ 26

const router = Router();

router.post("/login", asyncHandler(authController.login));
router.post("/refresh", asyncHandler(authController.refresh));
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/reset-password", asyncHandler(authController.resetPassword));

// เฉพาะ SUPER_ADMIN เท่านั้นที่ Register ผู้ใช้ใหม่ได้ (spec ข้อ 3: "Register เฉพาะ Admin ที่ได้รับสิทธิ์")
router.post(
  "/register",
  authenticate,
  requireRole("SUPER_ADMIN"),
  asyncHandler(authController.register),
);

router.post("/logout", authenticate, asyncHandler(authController.logout));
router.post("/change-password", authenticate, asyncHandler(authController.changePassword));
router.get("/me", authenticate, asyncHandler(authController.me));

export default router;
