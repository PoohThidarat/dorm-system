"use client";

import { Fragment, useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { formatDate, formatMonth, formatTHB, INVOICE_STATUS_COLOR, INVOICE_STATUS_LABEL } from "../../../lib/format";
import { Invoice, invoicesApi } from "../../../lib/api";

// หน้าที่ของไฟล์: ผู้เช่าดูใบแจ้งหนี้ของตัวเอง (ค่าเช่า/ค่าน้ำ/ค่าไฟ/ค่าปรับ/ยอดค้าง) — spec ข้อ 2.3
// backend คืนเฉพาะบิลของผู้เช่าคนนี้ และไม่รวมบิล DRAFT (rule #7)

export default function TenantInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token) return;
    invoicesApi
      .mine(token, "?pageSize=50&sortBy=billingMonth&sortOrder=desc")
      .then((r) => setInvoices(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">ใบแจ้งหนี้ของฉัน</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {invoices && invoices.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">
          ยังไม่มีใบแจ้งหนี้
        </p>
      )}

      <div className="space-y-3">
        {invoices?.map((inv) => (
          <Fragment key={inv.id}>
            <button
              onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              className="w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {inv.invoiceNumber} · เดือน {formatMonth(inv.billingMonth)}
                  </p>
                  <p className="text-xs text-slate-500">ห้อง {inv.contract.room.roomNumber} · ครบกำหนด {formatDate(inv.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatTHB(inv.total)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLOR[inv.status]}`}>
                    {INVOICE_STATUS_LABEL[inv.status]}
                  </span>
                </div>
              </div>

              {expanded === inv.id && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">
                  {inv.items.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>{it.label}</span>
                      <span>{formatTHB(it.amount)}</span>
                    </li>
                  ))}
                  {Number(inv.fine) > 0 && (
                    <li className="flex justify-between text-red-600">
                      <span>ค่าปรับล่าช้า</span>
                      <span>{formatTHB(inv.fine)}</span>
                    </li>
                  )}
                  <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                    <span>รวมทั้งสิ้น</span>
                    <span>{formatTHB(inv.total)}</span>
                  </li>
                </ul>
              )}
            </button>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
