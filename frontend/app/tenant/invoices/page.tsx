"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import {
  canPayInvoice,
  formatDate,
  formatMonth,
  formatTHB,
  INVOICE_STATUS_COLOR,
  INVOICE_STATUS_LABEL,
  invoiceBalance,
  invoiceHasPendingPayment,
  invoicePaid,
  todayValue,
} from "../../../lib/format";
import { Invoice, invoicesApi, paymentsApi } from "../../../lib/api";

// หน้าที่ของไฟล์: ผู้เช่าดูใบแจ้งหนี้ของตัวเอง + แจ้งชำระเงินพร้อมแนบสลิป (spec ข้อ 2.3, 11)
// backend คืนเฉพาะบิลของผู้เช่าคนนี้ และไม่รวมบิล DRAFT (rule #7)

const MAX_SLIP_BYTES = 5 * 1024 * 1024;

function PayForm({ invoice, onDone }: { invoice: Invoice; onDone: (message: string) => void }) {
  const balance = invoiceBalance(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState<"BANK_TRANSFER" | "QR_PAYMENT">("BANK_TRANSFER");
  const [date, setDate] = useState(todayValue());
  const [reference, setReference] = useState("");
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function onSlipChange(file: File | null) {
    setError(null);
    if (file && file.size > MAX_SLIP_BYTES) {
      setError("ไฟล์สลิปต้องมีขนาดไม่เกิน 5MB");
      setSlip(null);
      return;
    }
    setSlip(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getCookie("accessToken");
    if (!token || !slip) return;
    if (Number(amount) > balance) {
      setError(`จำนวนเงินต้องไม่เกินยอดคงเหลือ ${formatTHB(balance)}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("invoiceId", String(invoice.id));
      form.append("amount", amount);
      form.append("method", method);
      form.append("paymentDate", date);
      if (reference) form.append("referenceNumber", reference);
      form.append("slip", slip);
      await paymentsApi.submit(token, form);
      onDone("ส่งหลักฐานการชำระเงินแล้ว รอผู้ดูแลตรวจสอบ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "แจ้งชำระไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <p className="text-sm font-medium text-slate-800">แจ้งชำระเงิน · คงเหลือ {formatTHB(balance)}</p>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-500">
          จำนวนเงิน (บาท)
          <input required type="number" step="0.01" min="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        <label className="text-xs text-slate-500">
          วันที่โอน
          <input required type="date" max={todayValue()} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        <label className="text-xs text-slate-500">
          ช่องทาง
          <select value={method} onChange={(e) => setMethod(e.target.value as "BANK_TRANSFER" | "QR_PAYMENT")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900">
            <option value="BANK_TRANSFER">โอนผ่านธนาคาร</option>
            <option value="QR_PAYMENT">QR Payment</option>
          </select>
        </label>
        <label className="text-xs text-slate-500">
          เลขอ้างอิงในสลิป (ถ้ามี)
          <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
      </div>
      <label className="block text-xs text-slate-500">
        แนบสลิป (JPG / PNG / WEBP ไม่เกิน 5MB)
        <input required type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onSlipChange(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-slate-700" />
      </label>
      <button type="submit" disabled={saving || !slip} className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50">
        {saving ? "กำลังส่ง..." : "ส่งหลักฐานการชำระเงิน"}
      </button>
    </form>
  );
}

export default function TenantInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [paying, setPaying] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getCookie("accessToken");
    if (!token) return;
    try {
      const r = await invoicesApi.mine(token, "?pageSize=50&sortBy=billingMonth&sortOrder=desc");
      setInvoices(r.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-900">ใบแจ้งหนี้ของฉัน</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}
      {invoices && invoices.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200">ยังไม่มีใบแจ้งหนี้</p>
      )}

      <div className="space-y-3">
        {invoices?.map((inv) => {
          const paid = invoicePaid(inv);
          return (
            <div key={inv.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <button onClick={() => setExpanded(expanded === inv.id ? null : inv.id)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{inv.invoiceNumber} · เดือน {formatMonth(inv.billingMonth)}</p>
                  <p className="text-xs text-slate-500">ห้อง {inv.contract.room.roomNumber} · ครบกำหนด {formatDate(inv.dueDate)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatTHB(inv.total)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${INVOICE_STATUS_COLOR[inv.status]}`}>{INVOICE_STATUS_LABEL[inv.status]}</span>
                </div>
              </button>

              {invoiceHasPendingPayment(inv) && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">มีรายการแจ้งชำระที่รอผู้ดูแลตรวจสอบ</p>
              )}

              {expanded === inv.id && (
                <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-700">
                  {inv.items.map((it) => (
                    <li key={it.id} className="flex justify-between"><span>{it.label}</span><span>{formatTHB(it.amount)}</span></li>
                  ))}
                  {Number(inv.fine) > 0 && (
                    <li className="flex justify-between text-red-600"><span>ค่าปรับล่าช้า</span><span>{formatTHB(inv.fine)}</span></li>
                  )}
                  <li className="flex justify-between border-t border-slate-100 pt-1 font-semibold"><span>รวมทั้งสิ้น</span><span>{formatTHB(inv.total)}</span></li>
                  {paid > 0 && (
                    <>
                      <li className="flex justify-between text-emerald-700"><span>ชำระแล้ว</span><span>{formatTHB(paid)}</span></li>
                      <li className="flex justify-between font-semibold text-amber-700"><span>คงเหลือ</span><span>{formatTHB(invoiceBalance(inv))}</span></li>
                    </>
                  )}
                </ul>
              )}

              {canPayInvoice(inv) && paying !== inv.id && (
                <button onClick={() => { setPaying(inv.id); setExpanded(inv.id); setNotice(null); }} className="mt-3 w-full rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  แจ้งชำระเงิน
                </button>
              )}
              {paying === inv.id && (
                <PayForm
                  invoice={inv}
                  onDone={(message) => { setPaying(null); setNotice(message); load(); }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
