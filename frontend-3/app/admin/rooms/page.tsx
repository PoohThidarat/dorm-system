"use client";

import { useEffect, useState, FormEvent } from "react";
import { getCookie } from "../../../lib/cookies";
import { roomsApi, roomTypesApi, Room, RoomType, RoomStatus } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าจัดการห้องพัก - list + create + เปลี่ยนสถานะ (spec ข้อ 5)

const STATUS_LABEL: Record<RoomStatus, string> = {
  AVAILABLE: "ว่าง",
  OCCUPIED: "มีผู้เช่า",
  RESERVED: "จองแล้ว",
  MAINTENANCE: "กำลังซ่อม",
  INACTIVE: "ปิดใช้งาน",
};

const STATUS_COLOR: Record<RoomStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700",
  OCCUPIED: "bg-blue-100 text-blue-700",
  RESERVED: "bg-amber-100 text-amber-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  INACTIVE: "bg-slate-200 text-slate-600",
};

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    roomNumber: "",
    floor: "1",
    roomTypeId: "",
    monthlyRent: "",
    deposit: "",
  });

  const token = getCookie("accessToken");

  async function loadData() {
    if (!token) return;
    try {
      const [roomList, typeList] = await Promise.all([roomsApi.list(token), roomTypesApi.list(token)]);
      setRooms(roomList.items);
      setRoomTypes(typeList);
      if (typeList.length && !form.roomTypeId) {
        setForm((f) => ({ ...f, roomTypeId: String(typeList[0].id) }));
      }
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
      await roomsApi.create(token, {
        roomNumber: form.roomNumber,
        floor: Number(form.floor),
        roomTypeId: Number(form.roomTypeId),
        monthlyRent: Number(form.monthlyRent),
        deposit: Number(form.deposit),
      });
      setForm((f) => ({ ...f, roomNumber: "", monthlyRent: "", deposit: "" }));
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(room: Room, status: RoomStatus) {
    if (!token) return;
    try {
      await roomsApi.changeStatus(token, room.id, status);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">จัดการห้องพัก</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "ยกเลิก" : "+ เพิ่มห้อง"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 md:grid-cols-5">
          <input
            required
            placeholder="เลขห้อง"
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="ชั้น"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={form.roomTypeId}
            onChange={(e) => setForm({ ...form, roomTypeId: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {roomTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            required
            type="number"
            placeholder="ค่าเช่า/เดือน"
            value={form.monthlyRent}
            onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="เงินประกัน"
            value={form.deposit}
            onChange={(e) => setForm({ ...form, deposit: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="col-span-2 rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-1"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">เลขห้อง</th>
              <th className="px-4 py-3">ชั้น</th>
              <th className="px-4 py-3">ประเภท</th>
              <th className="px-4 py-3">ค่าเช่า</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3">เปลี่ยนสถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีห้องพักในระบบ
                </td>
              </tr>
            )}
            {rooms.map((room) => (
              <tr key={room.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{room.roomNumber}</td>
                <td className="px-4 py-3">{room.floor}</td>
                <td className="px-4 py-3">{room.roomType?.name}</td>
                <td className="px-4 py-3">{Number(room.monthlyRent).toLocaleString()} บาท</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLOR[room.status]}`}>
                    {STATUS_LABEL[room.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={room.status}
                    onChange={(e) => handleStatusChange(room, e.target.value as RoomStatus)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  >
                    {Object.keys(STATUS_LABEL).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s as RoomStatus]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
