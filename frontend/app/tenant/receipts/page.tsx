"use client";

import { useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { downloadBlob, openBlobInNewTab } from "../../../lib/files";
import { formatDate, formatMonth, formatTHB, PAYMENT_METHOD_LABEL } from "../../../lib/format";
import { Receipt, receiptsApi } from "../../../lib/api";

// หน้าที่ของไฟล์: ผู้เช่าดูใบเสร็จของตัวเอง เปิดดู/พิมพ์ หรือดาวน์โหลด PDF (spec ข้อ 12)

export default function TenantReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token) return;
    receiptsApi
      .mine(token, "?pageSize=50&sortBy=id&sortOrder=desc")
      .then((r) => setReceipts(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">ใบเสร็จของฉัน</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {receipts && receipts.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">ยังไม่มีใบเสร็จ (ใบเสร็จจะออกเมื่อผู้ดูแลอนุมัติการชำระเงิน)</p>
      )}

      <div className="space-y-3">
        {receipts?.map((r) => {
          const token = getCookie("accessToken") ?? "";
          return (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.receiptNumber}</p>
                  <p className="text-xs text-slate-500">
                    บิล {r.payment.invoice.invoiceNumber} · เดือน {formatMonth(r.payment.invoice.billingMonth)} · ห้อง {r.payment.invoice.contract.room.roomNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    {PAYMENT_METHOD_LABEL[r.payment.method]} · ชำระ {formatDate(r.payment.paymentDate)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{formatTHB(r.payment.amount)}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => run(() => openBlobInNewTab(() => receiptsApi.pdf(token, r.id)))} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                  เปิด / พิมพ์
                </button>
                <button onClick={() => run(() => downloadBlob(() => receiptsApi.pdf(token, r.id, true), `${r.receiptNumber}.pdf`))} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
                  ดาวน์โหลด PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
