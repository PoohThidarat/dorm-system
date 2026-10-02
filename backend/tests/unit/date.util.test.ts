import {
  currentBillingMonth,
  defaultDueDate,
  diffInDays,
  parseBillingMonth,
  previousBillingMonth,
} from "../../src/utils/date.util";

describe("date.util", () => {
  it("parseBillingMonth แปลง YYYY-MM เป็นวันที่ 1 (UTC)", () => {
    expect(parseBillingMonth("2026-09").toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("currentBillingMonth ใช้เวลาไทย: 31 ส.ค. 18:00 UTC = 1 ก.ย. 01:00 เวลาไทย", () => {
    const now = new Date("2026-08-31T18:00:00Z");
    expect(currentBillingMonth(now).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("previousBillingMonth ข้ามปีได้", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    expect(previousBillingMonth(now).toISOString()).toBe("2025-12-01T00:00:00.000Z");
  });

  it("defaultDueDate = วันที่ 5 ของเดือนถัดไป", () => {
    expect(defaultDueDate(parseBillingMonth("2026-12")).toISOString()).toBe("2027-01-05T00:00:00.000Z");
  });

  it("diffInDays นับจำนวนวันเต็ม", () => {
    expect(diffInDays(new Date("2026-09-10T12:00:00Z"), new Date("2026-09-05T00:00:00Z"))).toBe(5);
    expect(diffInDays(new Date("2026-09-01T00:00:00Z"), new Date("2026-09-05T00:00:00Z"))).toBe(-4);
  });
});
