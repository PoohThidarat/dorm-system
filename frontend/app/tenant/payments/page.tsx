"use client";

import { useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { openBlobInNewTab } from "../../../lib/files";
import { formatDate, formatMonth, formatTHB, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "../../../lib/format";
import { Payment, paymentsApi } from "../../../lib/api";

// หน้าที่ของไฟล์: ประวัติการแจ้งชำระเงินของผู้เช่า + สถานะการตรวจสอบ + เหตุผลถ้าถูกปฏิเสธ (spec ข้อ 11)

export default function TenantPaymentsPage() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token) return;
    paymentsApi
      .mine(token, "?pageSize=50&sortBy=id&sortOrder=desc")
      .then((r) => setPayments(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  async function viewSlip(id: number) {
    const token = getCookie("accessToken");
    if (!token) return;
    setError(null);
    try {
      await openBlobInNewTab(() => paymentsApi.slip(token, id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดสลิปไม่สำเร็จ");
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">การชำระเงินของฉัน</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {payments && payments.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">ยังไม่มีการแจ้งชำระเงิน</p>
      )}

      <div className="space-y-3">
        {payments?.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.invoice.invoiceNumber} · เดือน {formatMonth(p.invoice.billingMonth)}</p>
                <p className="text-xs text-slate-500">
                  {PAYMENT_METHOD_LABEL[p.method]} · วันที่ชำระ {formatDate(p.paymentDate)}
                  {p.referenceNumber && <> · อ้างอิง {p.referenceNumber}</>}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{formatTHB(p.amount)}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLOR[p.status]}`}>{PAYMENT_STATUS_LABEL[p.status]}</span>
              </div>
            </div>
            {p.status === "REJECTED" && p.rejectReason && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">เหตุผลที่ปฏิเสธ: {p.rejectReason}</p>
            )}
            <div className="mt-2 flex gap-4 text-sm">
              {p.slips.length > 0 && (
                <button onClick={() => viewSlip(p.id)} className="font-medium text-blue-600 hover:underline">ดูสลิป</button>
              )}
              {p.receipt && <span className="text-emerald-700">ใบเสร็จ {p.receipt.receiptNumber}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
