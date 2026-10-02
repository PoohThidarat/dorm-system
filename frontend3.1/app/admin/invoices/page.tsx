"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import {
  formatDate,
  formatMonth,
  formatTHB,
  INVOICE_STATUS_COLOR,
  INVOICE_STATUS_LABEL,
  previousMonthValue,
} from "../../../lib/format";
import { Contract, contractsApi, GenerateMonthlyResult, Invoice, invoicesApi, InvoiceStatus } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าจัดการใบแจ้งหนี้ (spec ข้อ 8)
// - ออกบิลรายเดือนให้ทุกสัญญา Active พร้อมสรุปผล (สร้างกี่ใบ/ข้าม/ยังไม่จดมิเตอร์)
// - สร้างบิลรายห้อง (DRAFT หรือออกทันที), ออกบิลจาก DRAFT, ยกเลิกบิล
// - ค้นหา + กรองสถานะ/เดือน + แถวขยายดูรายการในบิล

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>("");
  const [monthFilter, setMonthFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [batchMonth, setBatchMonth] = useState(previousMonthValue());
  const [batchResult, setBatchResult] = useState<GenerateMonthlyResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contractId: "",
    billingMonth: previousMonthValue(),
    discount: "",
    otherLabel: "",
    otherAmount: "",
    issue: false,
  });

  const token = getCookie("accessToken");

  const load = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams({ pageSize: "50", sortBy: "id", sortOrder: "desc" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (monthFilter) params.set("billingMonth", monthFilter);
    try {
      const [inv, con] = await Promise.all([
        invoicesApi.list(token, `?${params.toString()}`),
        contractsApi.list(token, "?status=ACTIVE&pageSize=100"),
      ]);
      setInvoices(inv.items);
      setContracts(con.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [token, search, statusFilter, monthFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGenerate() {
    if (!token) return;
    if (!confirm(`ออกบิลของเดือน ${batchMonth} ให้ทุกสัญญาที่ยัง Active ?`)) return;
    setError(null);
    setNotice(null);
    try {
      setBatchResult(await invoicesApi.generateMonthly(token, batchMonth));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ออกบิลไม่สำเร็จ");
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await invoicesApi.create(token, {
        contractId: Number(form.contractId),
        billingMonth: form.billingMonth,
        discount: form.discount ? Number(form.discount) : 0,
        otherCharges:
          form.otherLabel && form.otherAmount
            ? [{ label: form.otherLabel, amount: Number(form.otherAmount) }]
            : [],
        issue: form.issue,
      });
      const missing = [
        result.missingReadings.water && "น้ำ",
        result.missingReadings.electricity && "ไฟ",
      ].filter(Boolean);
      setNotice(
        `สร้างบิล ${result.invoice.invoiceNumber} สำเร็จ` +
          (missing.length ? ` (ยังไม่ได้จดมิเตอร์${missing.join("/")} ของเดือนนี้ ค่าจึงเป็น 0)` : ""),
      );
      setShowForm(false);
      setForm({ ...form, contractId: "", discount: "", otherLabel: "", otherAmount: "", issue: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างบิลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function act(fn: () => Promise<unknown>, failMessage: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : failMessage);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">ใบแจ้งหนี้</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={batchMonth}
            onChange={(e) => setBatchMonth(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button onClick={handleGenerate} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            ออกบิลรายเดือนทั้งหมด
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {showForm ? "ยกเลิก" : "+ สร้างบิลรายห้อง"}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      {batchResult && (
        <div className="mb-4 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-900">สรุปการออกบิลรายเดือน: สร้างสำเร็จ {batchResult.createdCount} ใบ</p>
          {batchResult.skipped.length > 0 && (
            <p className="mt-1 text-slate-600">
              ข้าม {batchResult.skipped.length} สัญญา:{" "}
              {batchResult.skipped.map((s) => `ห้อง ${s.roomNumber} (${s.reason})`).join(", ")}
            </p>
          )}
          {batchResult.missingReadings.length > 0 && (
            <p className="mt-1 text-amber-700">
              ยังไม่ได้จดมิเตอร์ของห้อง:{" "}
              {batchResult.missingReadings
                .map((m) => `${m.roomNumber} (${[m.water && "น้ำ", m.electricity && "ไฟ"].filter(Boolean).join("/")})`)
                .join(", ")}{" "}
              — ค่าน้ำ/ไฟของห้องเหล่านี้ในบิลเป็น 0
            </p>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-4">
          <select required value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })} className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2">
            <option value="">เลือกสัญญา (ห้อง / ผู้เช่า)</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.room.roomNumber} — {c.tenant.user.firstName} {c.tenant.user.lastName}
              </option>
            ))}
          </select>
          <input required type="month" value={form.billingMonth} onChange={(e) => setForm({ ...form, billingMonth: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" min="0" placeholder="ส่วนลด (บาท)" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="ค่าใช้จ่ายอื่น (ชื่อรายการ)" value={form.otherLabel} onChange={(e) => setForm({ ...form, otherLabel: e.target.value })} className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="number" min="0" placeholder="จำนวนเงิน" value={form.otherAmount} onChange={(e) => setForm({ ...form, otherAmount: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.checked })} />
            ออกบิลทันที
          </label>
          <button type="submit" disabled={saving} className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-4">
            {saving ? "กำลังสร้าง..." : "สร้างบิล"}
          </button>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input placeholder="ค้นหาเลขบิล / ห้อง / ชื่อผู้เช่า" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | InvoiceStatus)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">ทุกสถานะ</option>
          {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขที่บิล</th>
              <th className="px-4 py-3">ห้อง</th>
              <th className="px-4 py-3">ผู้เช่า</th>
              <th className="px-4 py-3">เดือน</th>
              <th className="px-4 py-3">ยอดรวม</th>
              <th className="px-4 py-3">ครบกำหนด</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">ไม่พบใบแจ้งหนี้</td>
              </tr>
            )}
            {invoices.map((inv) => (
              <Fragment key={inv.id}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.contract.room.roomNumber}</td>
                  <td className="px-4 py-3">{inv.contract.tenant.user.firstName} {inv.contract.tenant.user.lastName}</td>
                  <td className="px-4 py-3">{formatMonth(inv.billingMonth)}</td>
                  <td className="px-4 py-3">{formatTHB(inv.total)}</td>
                  <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${INVOICE_STATUS_COLOR[inv.status]}`}>
                      {INVOICE_STATUS_LABEL[inv.status]}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {inv.status === "DRAFT" && token && (
                      <button className="font-medium text-blue-600 hover:underline" onClick={() => act(() => invoicesApi.issue(token, inv.id), "ออกบิลไม่สำเร็จ")}>
                        ออกบิล
                      </button>
                    )}
                    {inv.status !== "PAID" && inv.status !== "CANCELLED" && token && (
                      <button
                        className="font-medium text-red-600 hover:underline"
                        onClick={() => confirm(`ยกเลิกบิล ${inv.invoiceNumber} ?`) && act(() => invoicesApi.cancel(token, inv.id), "ยกเลิกไม่สำเร็จ")}
                      >
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === inv.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-6 py-3">
                      <ul className="max-w-md space-y-1 text-sm text-slate-700">
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
                        <li className="flex justify-between border-t border-slate-200 pt-1 font-semibold">
                          <span>รวมทั้งสิ้น</span>
                          <span>{formatTHB(inv.total)}</span>
                        </li>
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
