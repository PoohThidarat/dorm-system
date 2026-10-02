import { Router } from "express";
import authRoutes from "./auth.routes";
import roomRoutes, { roomTypeRouter } from "./room.routes";
import tenantRoutes from "./tenant.routes";
import contractRoutes from "./contract.routes";
import meterRoutes from "./meter.routes";
import invoiceRoutes from "./invoice.routes";

// หน้าที่ของไฟล์: รวม route ของทุก module เข้าด้วยกัน ต่อ prefix /api
// Phase ถัดไปจะเพิ่ม: payments.routes, maintenance.routes ฯลฯ ที่นี่

const router = Router();

router.use("/auth", authRoutes);
router.use("/rooms", roomRoutes);
router.use("/room-types", roomTypeRouter);
router.use("/tenants", tenantRoutes);
router.use("/contracts", contractRoutes);
router.use("/meters", meterRoutes);
router.use("/invoices", invoiceRoutes);

export default router;
