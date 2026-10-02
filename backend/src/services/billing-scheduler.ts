import cron from "node-cron";
import { env } from "../config/env";
import { invoiceService } from "./invoice.service";
import { previousBillingMonth } from "../utils/date.util";

// หน้าที่ของไฟล์: งานตั้งเวลาอัตโนมัติของระบบบิล (spec ข้อ 8 "สร้าง Invoice อัตโนมัติทุกเดือน")
//  - วันที่ 1 ของทุกเดือน 01:00 (เวลาไทย): ออกบิลของ "เดือนที่แล้ว" ให้ทุกสัญญา Active
//    (ต้องจดมิเตอร์เดือนที่แล้วให้เสร็จก่อนถึงวันที่ 1 ไม่เช่นนั้นค่าน้ำ/ไฟจะเป็น 0 — ระบบแจ้งใน log)
//  - ทุกวัน 02:00: อัปเดตบิลเลยกำหนดเป็น OVERDUE และคำนวณค่าปรับ
// เรียกใช้จาก server.ts เท่านั้น (ไม่เรียกใน createApp เพื่อไม่ให้ test ไปเริ่ม cron)

const TIMEZONE = "Asia/Bangkok";

export function startBillingScheduler() {
  if (!env.billing.schedulerEnabled) {
    console.log("⏸️  Billing scheduler ถูกปิดไว้ (BILLING_SCHEDULER_ENABLED=false)");
    return;
  }

  cron.schedule(
    "0 1 1 * *",
    async () => {
      try {
        const result = await invoiceService.generateMonthly(previousBillingMonth());
        console.log(`[billing] ออกบิลอัตโนมัติ ${result.createdCount} ใบ, ข้าม ${result.skipped.length}, ไม่มีมิเตอร์ ${result.missingReadings.length} ห้อง`);
      } catch (err) {
        console.error("[billing] ออกบิลรายเดือนล้มเหลว", err);
      }
    },
    { timezone: TIMEZONE },
  );

  cron.schedule(
    "0 2 * * *",
    async () => {
      try {
        const result = await invoiceService.applyOverdueAndFines();
        console.log(`[billing] ตรวจบิลเลยกำหนด ${result.checked} ใบ, อัปเดต ${result.updated}`);
      } catch (err) {
        console.error("[billing] อัปเดตค่าปรับล้มเหลว", err);
      }
    },
    { timezone: TIMEZONE },
  );

  console.log("⏰ Billing scheduler เริ่มทำงาน (ออกบิลทุกวันที่ 1, ตรวจค่าปรับทุกวัน)");
}
