"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { formatDate, formatMonth, formatTHB, INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL } from "../../../lib/format";
import { Invoice, invoicesApi } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าแรกของผู้เช่า สรุปยอดค้างชำระและบิลล่าสุด (spec ข้อ 2.3)
// ข้อมูลอื่น (สัญญา, แจ้งซ่อม) จะเพิ่มใน Phase ถัดไป

const OUTSTANDING = ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"];

export default function TenantDashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token) return;
    invoicesApi
      .mine(token, "?pageSize=50&sortBy=billingMonth&sortOrder=desc")
      .then((r) => setInvoices(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const unpaid = (invoices ?? []).filter((i) => OUTSTANDING.includes(i.status));
  const outstandingTotal = unpaid.reduce((sum, i) => sum + Number(i.total), 0);
  const overdueCount = unpaid.filter((i) => i.status === "OVERDUE").length;
  const latest = invoices?.[0];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">หน้าแรก</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">ยอดค้างชำระ</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{invoices ? formatTHB(outstandingTotal) : "..."}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">บิลที่ยังไม่ชำระ</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{invoices ? unpaid.length : "..."}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">เกินกำหนดชำระ</p>
          <p className={`mt-1 text-2xl font-semibold ${overdueCount ? "text-red-600" : "text-slate-900"}`}>
            {invoices ? overdueCount : "..."}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">บิลล่าสุด</h2>
          <Link href="/tenant/invoices" className="text-sm font-medium text-blue-600 hover:underline">ดูทั้งหมด</Link>
        </div>
        {invoices && !latest && <p className="py-4 text-center text-sm text-slate-400">ยังไม่มีใบแจ้งหนี้</p>}
        {latest && (
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-slate-900">{latest.invoiceNumber} · ห้อง {latest.contract.room.roomNumber}</p>
              <p className="text-slate-500">เดือน {formatMonth(latest.billingMonth)} · ครบกำหนด {formatDate(latest.dueDate)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-900">{formatTHB(latest.total)}</p>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${INVOICE_STATUS_COLOR[latest.status]}`}>
                {INVOICE_STATUS_LABEL[latest.status]}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
