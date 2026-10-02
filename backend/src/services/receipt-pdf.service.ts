import path from "path";
import PDFDocument from "pdfkit";

// หน้าที่ของไฟล์: สร้างไฟล์ PDF ใบเสร็จรับเงินภาษาไทย (spec ข้อ 12) ด้วย PDFKit + ฟอนต์ Sarabun (OFL)
// เป็น pure renderer: รับข้อมูลที่พร้อมแสดงแล้วคืน Buffer ไม่แตะ DB/env จึงทดสอบได้ง่าย

export interface ReceiptPdfData {
  issuerName: string;
  issuerAddress: string;
  receiptNumber: string;
  issuedDate: string; // DD/MM/YYYY
  tenantName: string;
  roomNumber: string;
  invoiceNumber: string;
  billingMonth: string; // MM/YYYY
  items: { label: string; amount: number }[];
  fine: number;
  invoiceTotal: number;
  paidAmount: number; // ยอดรับชำระครั้งนี้
  paidToDate: number; // ชำระสะสมถึงใบเสร็จนี้
  balance: number; // คงเหลือ
  methodLabel: string;
  paymentDate: string; // DD/MM/YYYY
  referenceNumber?: string;
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const REGULAR = "Sarabun";
const BOLD = "Sarabun-Bold";

export const baht = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function renderReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: `ใบเสร็จรับเงิน ${data.receiptNumber}`, Author: data.issuerName },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont(REGULAR, path.join(FONT_DIR, "Sarabun_400Regular.ttf"));
    doc.registerFont(BOLD, path.join(FONT_DIR, "Sarabun_700Bold.ttf"));

    const left = 50;
    const right = 545;
    const width = right - left;
    const amountX = 400;
    const amountW = right - amountX;

    // ---- หัวเอกสาร ----
    doc.font(BOLD).fontSize(18).fillColor("#0f172a").text(data.issuerName, left, 50, { width });
    if (data.issuerAddress) {
      doc.font(REGULAR).fontSize(10).fillColor("#64748b").text(data.issuerAddress, left, doc.y, { width });
    }
    doc.moveDown(0.6);
    doc.font(BOLD).fontSize(22).fillColor("#0f172a").text("ใบเสร็จรับเงิน", left, doc.y, { width, align: "center" });
    doc.font(REGULAR).fontSize(10).fillColor("#64748b").text("RECEIPT", left, doc.y, { width, align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#cbd5e1").lineWidth(1).stroke();
    doc.moveDown(0.6);

    // ---- ข้อมูลเอกสาร (2 คอลัมน์) ----
    const infoRow = (l1: string, v1: string, l2: string, v2: string) => {
      const y = doc.y;
      doc.font(REGULAR).fontSize(12).fillColor("#64748b").text(l1, left, y, { width: 90, continued: false });
      doc.font(BOLD).fillColor("#0f172a").text(v1, left + 90, y, { width: 170 });
      const afterLeft = doc.y;
      doc.font(REGULAR).fillColor("#64748b").text(l2, 320, y, { width: 70 });
      doc.font(BOLD).fillColor("#0f172a").text(v2, 390, y, { width: right - 390 });
      doc.y = Math.max(afterLeft, doc.y) + 3;
    };
    infoRow("เลขที่ใบเสร็จ", data.receiptNumber, "ผู้เช่า", data.tenantName);
    infoRow("วันที่ออก", data.issuedDate, "ห้อง", data.roomNumber);
    infoRow("อ้างอิงบิล", data.invoiceNumber, "ประจำเดือน", data.billingMonth);
    doc.moveDown(0.6);

    // ---- ตารางรายการ ----
    const headerY = doc.y;
    doc.rect(left, headerY, width, 24).fill("#f1f5f9");
    doc.font(BOLD).fontSize(12).fillColor("#334155");
    doc.text("รายการ", left + 10, headerY + 5, { width: 300 });
    doc.text("จำนวนเงิน (บาท)", amountX, headerY + 5, { width: amountW - 10, align: "right" });
    doc.y = headerY + 30;

    const row = (label: string, amount: number, opts: { bold?: boolean; color?: string } = {}) => {
      const y = doc.y;
      doc.font(opts.bold ? BOLD : REGULAR).fontSize(12).fillColor(opts.color ?? "#0f172a");
      doc.text(label, left + 10, y, { width: 330 });
      const labelBottom = doc.y;
      doc.text(baht(amount), amountX, y, { width: amountW - 10, align: "right" });
      doc.y = Math.max(labelBottom, doc.y) + 4;
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
      doc.y += 4;
    };

    for (const item of data.items) row(item.label, item.amount, item.amount < 0 ? { color: "#059669" } : {});
    if (data.fine > 0) row("ค่าปรับล่าช้า", data.fine, { color: "#dc2626" });
    row("ยอดรวมของบิล", data.invoiceTotal, { bold: true });
    doc.moveDown(0.8);

    // ---- กล่องยอดรับชำระ ----
    const boxY = doc.y;
    doc.roundedRect(left, boxY, width, 62, 6).fill("#ecfdf5");
    doc.font(REGULAR).fontSize(12).fillColor("#065f46").text("ยอดรับชำระครั้งนี้", left + 14, boxY + 10, { width: 250 });
    doc.font(BOLD).fontSize(22).fillColor("#065f46").text(`${baht(data.paidAmount)} บาท`, left + 14, boxY + 26, { width: 250 });
    doc.font(REGULAR).fontSize(11).fillColor("#065f46");
    doc.text(`ชำระโดย: ${data.methodLabel}`, 320, boxY + 10, { width: right - 330 });
    doc.text(`วันที่ชำระ: ${data.paymentDate}`, 320, doc.y, { width: right - 330 });
    if (data.referenceNumber) doc.text(`อ้างอิง: ${data.referenceNumber}`, 320, doc.y, { width: right - 330 });
    doc.y = boxY + 74;

    // ---- ยอดสะสม/คงเหลือ (แสดงเมื่อยังชำระไม่ครบ) ----
    if (data.balance > 0) {
      doc.font(REGULAR).fontSize(12).fillColor("#334155");
      doc.text(`ชำระสะสมถึงใบเสร็จนี้: ${baht(data.paidToDate)} บาท`, left, doc.y, { width });
      doc.font(BOLD).fillColor("#b45309").text(`ยอดคงเหลือที่ต้องชำระ: ${baht(data.balance)} บาท`, left, doc.y, { width });
      doc.moveDown(0.5);
    } else {
      doc.font(BOLD).fontSize(12).fillColor("#059669").text("ชำระครบถ้วนแล้ว", left, doc.y, { width });
      doc.moveDown(0.5);
    }

    // ---- ลายเซ็น + หมายเหตุท้ายกระดาษ ----
    const signY = Math.max(doc.y + 40, 660);
    doc.moveTo(370, signY).lineTo(right, signY).strokeColor("#94a3b8").lineWidth(0.7).stroke();
    doc.font(REGULAR).fontSize(11).fillColor("#334155").text("ผู้รับเงิน", 370, signY + 4, { width: right - 370, align: "center" });
    doc.font(REGULAR).fontSize(9).fillColor("#94a3b8").text(
      "เอกสารนี้ออกโดยระบบบริหารจัดการหอพักโดยอัตโนมัติ",
      left,
      780,
      { width, align: "center" },
    );

    doc.end();
  });
}
