"use client";

import { useEffect, useState, FormEvent } from "react";
import { getCookie } from "../../../lib/cookies";
import { tenantsApi, Tenant } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าจัดการผู้เช่า - list + create + ยกเลิกการเช่า (spec ข้อ 6)

const STATUS_LABEL: Record<Tenant["status"], string> = {
  ACTIVE: "อาศัยอยู่",
  INACTIVE: "ไม่มีสัญญา",
  MOVED_OUT: "ย้ายออกแล้ว",
};

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    nationalId: "",
    roomNumber: "",
  });

  const token = getCookie("accessToken");

  async function loadData() {
    if (!token) return;
    try {
      const result = await tenantsApi.list(token);
      setTenants(result.items);
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
      await tenantsApi.create(token, form);
      setForm({ email: "", password: "", firstName: "", lastName: "", phone: "", nationalId: "", roomNumber: "" });
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelRental(tenant: Tenant) {
    if (!token) return;
    if (!confirm(`ยกเลิกการเช่าของ ${tenant.user.firstName} ${tenant.user.lastName} ?`)) return;
    try {
      await tenantsApi.cancelRental(token, tenant.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิกไม่สำเร็จ");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">จัดการผู้เช่า</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "ยกเลิก" : "+ เพิ่มผู้เช่า"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-3">
          <input required type="email" placeholder="อีเมล" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required type="password" placeholder="รหัสผ่านเริ่มต้น" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required placeholder="เลขบัตรประชาชน 13 หลัก" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required placeholder="ชื่อ" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required placeholder="นามสกุล" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input required placeholder="ห้องปัจจุบัน" value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input placeholder="เบอร์โทร" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-1">
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">ชื่อ-นามสกุล</th>
              <th className="px-4 py-3">อีเมล</th>
              <th className="px-4 py-3">ห้องปัจจุบัน</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีผู้เช่าในระบบ
                </td>
              </tr>
            )}
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {tenant.user.firstName} {tenant.user.lastName}
                </td>
                <td className="px-4 py-3">{tenant.user.email}</td>
                <td className="px-4 py-3">{tenant.contracts[0]?.room.roomNumber ?? "-"}</td>
                <td className="px-4 py-3">{STATUS_LABEL[tenant.status]}</td>
                <td className="px-4 py-3">
                  {tenant.status === "ACTIVE" && (
                    <button
                      onClick={() => handleCancelRental(tenant)}
                      className="text-sm font-medium text-red-600 hover:underline"
                    >
                      ยกเลิกการเช่า
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
