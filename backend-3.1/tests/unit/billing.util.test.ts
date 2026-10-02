import {
  calculateElectricityBill,
  calculateLateFee,
  calculateTotalInvoice,
  calculateUsage,
  calculateWaterBill,
  generateInvoiceNumber,
} from "../../src/utils/billing.util";

// Unit Test ของ business logic การคำนวณบิล (spec ข้อ 32)

describe("calculateUsage", () => {
  it("คำนวณ Usage = Current - Previous", () => {
    expect(calculateUsage(100, 125)).toBe(25);
  });

  it("ยอมรับกรณีมิเตอร์เท่าเดิม (ไม่ได้ใช้)", () => {
    expect(calculateUsage(50, 50)).toBe(0);
  });

  it("ปฏิเสธเมื่อ Current น้อยกว่า Previous", () => {
    expect(() => calculateUsage(100, 99)).toThrow();
  });
});

describe("calculateWaterBill / calculateElectricityBill", () => {
  it("น้ำ = หน่วย x ราคาต่อหน่วย", () => {
    expect(calculateWaterBill(10, 18)).toBe(180);
  });

  it("ไฟ = หน่วย x ราคาต่อหน่วย", () => {
    expect(calculateElectricityBill(120, 8)).toBe(960);
  });

  it("ปัดเศษทศนิยม 2 ตำแหน่ง", () => {
    expect(calculateElectricityBill(3, 7.335)).toBe(22.01);
  });
});

describe("calculateTotalInvoice", () => {
  it("รวมค่าเช่า น้ำ ไฟ ค่าอื่น ๆ หักส่วนลด บวกค่าปรับ", () => {
    const total = calculateTotalInvoice({
      rent: 4000,
      water: 180,
      electricity: 960,
      otherCharges: 100,
      discount: 200,
      fine: 50,
    });
    expect(total).toBe(5090);
  });

  it("บิลที่มีแต่ค่าเช่า", () => {
    expect(
      calculateTotalInvoice({ rent: 4000, water: 0, electricity: 0, otherCharges: 0, discount: 0, fine: 0 }),
    ).toBe(4000);
  });
});

describe("calculateLateFee", () => {
  it("ไม่มีค่าปรับถ้ายังไม่เลยกำหนด", () => {
    expect(calculateLateFee(5000, 0)).toBe(0);
    expect(calculateLateFee(5000, -3)).toBe(0);
  });

  it("คิด 1% ต่อวันที่เกินกำหนด", () => {
    expect(calculateLateFee(5000, 5)).toBe(250);
  });

  it("ค่าปรับสูงสุดไม่เกิน 30% ของยอดก่อนค่าปรับ", () => {
    expect(calculateLateFee(5000, 90)).toBe(1500);
  });
});

describe("generateInvoiceNumber", () => {
  it("รูปแบบ INV-YYYYMM-NNNN", () => {
    expect(generateInvoiceNumber(new Date(2026, 8, 1), 7)).toBe("INV-202609-0007");
  });

  it("เติมเลข 0 หน้าเดือนและลำดับ", () => {
    expect(generateInvoiceNumber(new Date(2026, 0, 1), 123)).toBe("INV-202601-0123");
  });
});
