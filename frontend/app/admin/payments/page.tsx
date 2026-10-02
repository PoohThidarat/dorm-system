"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { formatDate, formatTHB, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_COLOR, PAYMENT_STATUS_LABEL } from "../../../lib/format";
import { Contract, contractsApi, invoicesApi, Payment, paymentsApi, PaymentMethod, PaymentStatus } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าตรวจสอบ/อนุมัติการชำระเงิน (spec ข้อ 11) + บันทึกรับชำระเงินสดหน้าเคาน์เตอร์
// อนุมัติแล้วระบบออกใบเสร็จให้อัตโนมัติ (rule #6) จึงไม่มีปุ่ม "สร้างใบเสร็จ" แยกในหน้านี้

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | PaymentStatus>("PENDING");
  const [search, setSearch] = useState("");
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [showRecordForm, setShowRecordForm] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [unpaidInvoiceOptions, setUnpaidInvoiceOptions] = useState<{ id: number; label: string; total: number }[]>([]);
  const [recordForm, setRecordForm] = useState({ invoiceId: "", amount: "", method: "CASH" as PaymentMethod, referenceNumber: "" });
  const [saving, setSaving] = useState(false);

  const token = getCookie("accessToken");

  const load = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams({ pageSize: "50", sortBy: "id", sortOrder: "desc" });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    try {
      const result = await paymentsApi.list(token, `?${params.toString()}`);
      setPayments(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [token, statusFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !showRecordForm) return;
    (async () => {
      try {
        const [con, inv] = await Promise.all([
          contractsApi.list(token, "?status=ACTIVE&pageSize=100"),
          invoicesApi.list(token, "?pageSize=100&sortBy=dueDate&sortOrder=asc"),
        ]);
        setContracts(con.items);
        const payable = ["ISSUED", "UNPAID", "PARTIAL", "OVERDUE"];
        setUnpaidInvoiceOptions(
          inv.items
            .filter((i) => payable.includes(i.status))
            .map((i) => ({
              id: i.id,
              label: `${i.invoiceNumber} — ห้อง ${i.contract.room.roomNumber} (${i.contract.tenant.user.firstName})`,
              total: Number(i.total),
            })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดรายการบิลไม่สำเร็จ");
      }
    })();
  }, [token, showRecordForm]);

  async function viewSlip(paymentId: number) {
    if (!token) return;
    setError(null);
    try {
      const blob = await paymentsApi.slip(token, paymentId);
      setSlipUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดสลิปไม่สำเร็จ");
    }
  }

  async function handleApprove(payment: Payment) {
    if (!token) return;
    if (!confirm(`อนุมัติการชำระของบิล ${payment.invoice.invoiceNumber} จำนวน ${formatTHB(payment.amount)} ?`)) return;
    setBusyId(payment.id);
    setError(null);
    setNotice(null);
    try {
      await paymentsApi.approve(token, payment.id);
      setNotice("อนุมัติสำเร็จ ระบบออกใบเสร็จให้อัตโนมัติแล้ว");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อนุมัติไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(payment: Payment) {
    if (!token) return;
    const reason = prompt("เหตุผลที่ปฏิเสธรายการนี้:");
    if (!reason || !reason.trim()) return;
    setBusyId(payment.id);
    setError(null);
    setNotice(null);
    try {
      await paymentsApi.reject(token, payment.id, reason.trim());
      setNotice("ปฏิเสธรายการแล้ว");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปฏิเสธไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecord(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await paymentsApi.record(token, {
        invoiceId: Number(recordForm.invoiceId),
        amount: Number(recordForm.amount),
        method: recordForm.method,
        referenceNumber: recordForm.referenceNumber || undefined,
      });
      setNotice("บันทึกรับชำระและออกใบเสร็จสำเร็จ");
      setRecordForm({ invoiceId: "", amount: "", method: "CASH", referenceNumber: "" });
      setShowRecordForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">การชำระเงิน</h1>
        <button
          onClick={() => setShowRecordForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showRecordForm ? "ยกเลิก" : "+ บันทึกรับชำระ (เงินสด/หน้าเคาน์เตอร์)"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {showRecordForm && (
        <form onSubmit={handleRecord} className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-4">
          <select
            required
            value={recordForm.invoiceId}
            onChange={(e) => {
              const inv = unpaidInvoiceOptions.find((o) => String(o.id) === e.target.value);
              setRecordForm({ ...recordForm, invoiceId: e.target.value, amount: inv ? String(inv.total) : recordForm.amount });
            }}
            className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">เลือกบิลที่ค้างชำระ</option>
            {unpaidInvoiceOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label} — {formatTHB(o.total)}</option>
            ))}
          </select>
          <input required type="number" min="0" step="0.01" placeholder="จำนวนเงิน" value={recordForm.amount} onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={recordForm.method} onChange={(e) => setRecordForm({ ...recordForm, method: e.target.value as PaymentMethod })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="CASH">เงินสด</option>
            <option value="BANK_TRANSFER">โอนธนาคาร</option>
            <option value="QR_PAYMENT">QR Payment</option>
          </select>
          <input placeholder="เลขอ้างอิง (ถ้ามี)" value={recordForm.referenceNumber} onChange={(e) => setRecordForm({ ...recordForm, referenceNumber: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-4">
            {saving ? "กำลังบันทึก..." : "บันทึกรับชำระ (อนุมัติทันที)"}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input placeholder="ค้นหาเลขบิล / ห้อง / ชื่อผู้เช่า / เลขอ้างอิง" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | PaymentStatus)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">ทุกสถานะ</option>
          <option value="PENDING">รอตรวจสอบ</option>
          <option value="APPROVED">อนุมัติแล้ว</option>
          <option value="REJECTED">ปฏิเสธแล้ว</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">บิล</th>
              <th className="px-4 py-3">ห้อง / ผู้เช่า</th>
              <th className="px-4 py-3">จำนวนเงิน</th>
              <th className="px-4 py-3">วิธีชำระ</th>
              <th className="px-4 py-3">วันที่แจ้ง</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">ไม่พบรายการชำระเงิน</td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{p.invoice.invoiceNumber}</td>
                <td className="px-4 py-3">
                  {p.invoice.contract.room.roomNumber} — {p.invoice.contract.tenant.user.firstName} {p.invoice.contract.tenant.user.lastName}
                </td>
                <td className="px-4 py-3">{formatTHB(p.amount)}</td>
                <td className="px-4 py-3">
                  {PAYMENT_METHOD_LABEL[p.method]}
                  {p.referenceNumber && <span className="block text-xs text-slate-400">อ้างอิง: {p.referenceNumber}</span>}
                </td>
                <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${PAYMENT_STATUS_COLOR[p.status]}`}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                  {p.status === "REJECTED" && p.rejectReason && (
                    <span className="block text-xs text-slate-400">เหตุผล: {p.rejectReason}</span>
                  )}
                </td>
                <td className="space-x-3 px-4 py-3">
                  {p.slips.length > 0 && (
                    <button onClick={() => viewSlip(p.id)} className="font-medium text-blue-600 hover:underline">
                      ดูสลิป
                    </button>
                  )}
                  {p.status === "PENDING" && (
                    <>
                      <button disabled={busyId === p.id} onClick={() => handleApprove(p)} className="font-medium text-emerald-600 hover:underline disabled:opacity-50">
                        อนุมัติ
                      </button>
                      <button disabled={busyId === p.id} onClick={() => handleReject(p)} className="font-medium text-red-600 hover:underline disabled:opacity-50">
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slipUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setSlipUrl(null)}>
          <div className="max-h-full max-w-lg overflow-auto rounded-xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex justify-end">
              <button onClick={() => setSlipUrl(null)} className="text-sm text-slate-500 hover:text-slate-700">ปิด ✕</button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slipUrl} alt="สลิปการโอนเงิน" className="max-h-[70vh] w-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
