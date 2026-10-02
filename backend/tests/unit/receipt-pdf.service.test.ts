import { baht, ReceiptPdfData, renderReceiptPdf } from "../../src/services/receipt-pdf.service";

// ทดสอบตัวสร้าง PDF จริง (ใช้ฟอนต์ Sarabun ในโฟลเดอร์ assets/fonts) — ไม่ต้องต่อ DB

const data: ReceiptPdfData = {
  issuerName: "หอพักตัวอย่าง",
  issuerAddress: "123 ถ.ตัวอย่าง กรุงเทพฯ",
  receiptNumber: "REC-202609-0001",
  issuedDate: "28/09/2026",
  tenantName: "สมชาย ใจดี",
  roomNumber: "101",
  invoiceNumber: "INV-202608-0001",
  billingMonth: "08/2026",
  items: [
    { label: "ค่าเช่าห้อง", amount: 4000 },
    { label: "ส่วนลด", amount: -100 },
  ],
  fine: 0,
  invoiceTotal: 3900,
  paidAmount: 3900,
  paidToDate: 3900,
  balance: 0,
  methodLabel: "เงินสด",
  paymentDate: "27/09/2026",
};

describe("renderReceiptPdf", () => {
  it("สร้างไฟล์ PDF ที่ถูกต้อง (header %PDF และ 1 หน้า)", async () => {
    const buffer = await renderReceiptPdf(data);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5000); // ฝังฟอนต์ไทยแล้ว
    expect(buffer.toString("latin1")).toContain("/Count 1");
  });

  it("รองรับบิลจ่ายบางส่วนที่มีค่าปรับ ที่อยู่ว่าง และชื่อรายการยาวมาก", async () => {
    const buffer = await renderReceiptPdf({
      ...data,
      issuerAddress: "",
      fine: 260.5,
      invoiceTotal: 4160.5,
      paidAmount: 2000,
      paidToDate: 2000,
      balance: 2160.5,
      referenceNumber: "REF-ABC-123",
      items: [{ label: "ค่าบริการพื้นที่ส่วนกลาง ".repeat(12), amount: 4000 }],
    });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.toString("latin1")).toContain("/Count 1");
  });
});

describe("baht", () => {
  it("จัดรูปแบบเงินเป็นทศนิยม 2 ตำแหน่งพร้อมคั่นหลักพัน", () => {
    expect(baht(4320)).toBe("4,320.00");
    expect(baht(1234567.5)).toBe("1,234,567.50");
    expect(baht(-100)).toBe("-100.00");
  });
});
