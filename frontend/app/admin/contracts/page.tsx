"use client";

import { useEffect, useState, FormEvent } from "react";
import { getCookie } from "../../../lib/cookies";
import { contractsApi, roomsApi, tenantsApi, Contract, Room, Tenant } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าจัดการสัญญาเช่า - list + create + terminate (spec ข้อ 7)

const STATUS_LABEL: Record<Contract["status"], string> = {
  ACTIVE: "กำลังเช่า",
  EXPIRED: "หมดอายุ",
  TERMINATED: "ยกเลิกแล้ว",
};

export default function AdminContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    roomId: "",
    tenantId: "",
    startDate: "",
    endDate: "",
    deposit: "",
  });

  const token = getCookie("accessToken");

  async function loadData() {
    if (!token) return;
    try {
      const [contractList, roomList, tenantList] = await Promise.all([
        contractsApi.list(token),
        roomsApi.list(token),
        tenantsApi.list(token),
      ]);
      setContracts(contractList.items);
      setAvailableRooms(roomList.items.filter((r) => r.status === "AVAILABLE"));
      setTenants(tenantList.items.filter((t) => t.status !== "ACTIVE"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await contractsApi.create(token, {
        roomId: Number(form.roomId),
        tenantId: Number(form.tenantId),
        startDate: form.startDate,
        endDate: form.endDate,
        deposit: Number(form.deposit),
      });
      setForm({ roomId: "", tenantId: "", startDate: "", endDate: "", deposit: "" });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างสัญญาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleTerminate(contract: Contract) {
    if (!token) return;
    if (!confirm(`ยกเลิกสัญญาห้อง ${contract.room.roomNumber} ?`)) return;
    try {
      await contractsApi.terminate(token, contract.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">จัดการสัญญาเช่า</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "ยกเลิก" : "+ สร้างสัญญา"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-5">
          <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">เลือกห้อง (ว่างเท่านั้น)</option>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.roomNumber}</option>
            ))}
          </select>
          <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">เลือกผู้เช่า</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
            ))}
          </select>
          <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="number" placeholder="เงินประกัน" value={form.deposit} onChange={(e) => setForm({ ...form, deposit: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-1">
            {saving ? "กำลังบันทึก..." : "สร้างสัญญา"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">ห้อง</th>
              <th className="px-4 py-3">ผู้เช่า</th>
              <th className="px-4 py-3">เริ่มสัญญา</th>
              <th className="px-4 py-3">สิ้นสุดสัญญา</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีสัญญาเช่าในระบบ
                </td>
              </tr>
            )}
            {contracts.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.room.roomNumber}</td>
                <td className="px-4 py-3">{c.tenant.user.firstName} {c.tenant.user.lastName}</td>
                <td className="px-4 py-3">{new Date(c.startDate).toLocaleDateString("th-TH")}</td>
                <td className="px-4 py-3">{new Date(c.endDate).toLocaleDateString("th-TH")}</td>
                <td className="px-4 py-3">{STATUS_LABEL[c.status]}</td>
                <td className="px-4 py-3">
                  {c.status === "ACTIVE" && (
                    <button onClick={() => handleTerminate(c)} className="text-sm font-medium text-red-600 hover:underline">
                      ยกเลิกสัญญา
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
