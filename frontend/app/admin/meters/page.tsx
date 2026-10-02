"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { formatMonth, formatTHB, previousMonthValue } from "../../../lib/format";
import { metersApi, MeterKind, MeterLatest, MeterReading, Room, roomsApi } from "../../../lib/api";

// หน้าที่ของไฟล์: หน้าจดมิเตอร์น้ำ/ไฟ + ดูประวัติย้อนหลัง (spec ข้อ 9, 10)
// Usage = Current - Previous, Total = Usage x ราคาต่อหน่วย — ระบบคำนวณจริงที่ backend
// หน้านี้แสดงตัวอย่างการคำนวณให้เห็นก่อนกดบันทึก และกัน Current < Previous ตั้งแต่ฝั่ง UI

const KIND_LABEL: Record<MeterKind, string> = { water: "มิเตอร์น้ำ", electricity: "มิเตอร์ไฟ" };

export default function AdminMetersPage() {
  const [kind, setKind] = useState<MeterKind>("water");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState("");
  const [month, setMonth] = useState(previousMonthValue());
  const [current, setCurrent] = useState("");
  const [latest, setLatest] = useState<MeterLatest | null>(null);
  const [history, setHistory] = useState<MeterReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const token = getCookie("accessToken");

  useEffect(() => {
    if (!token) return;
    roomsApi
      .list(token, "?pageSize=100&sortBy=roomNumber")
      .then((r) => {
        setRooms(r.items);
        if (r.items.length) setRoomId(String(r.items[0].id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดห้องไม่สำเร็จ"));
  }, [token]);

  const loadRoomData = useCallback(async () => {
    if (!token || !roomId) return;
    try {
      const [l, h] = await Promise.all([
        metersApi.latest(token, kind, Number(roomId)),
        metersApi.history(token, kind, Number(roomId)),
      ]);
      setLatest(l);
      setHistory(h.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดข้อมูลมิเตอร์ไม่สำเร็จ");
    }
  }, [token, kind, roomId]);

  useEffect(() => {
    loadRoomData();
  }, [loadRoomData]);

  const currentNumber = Number(current);
  const previous = latest?.previousMeter ?? 0;
  const hasValue = current !== "" && !Number.isNaN(currentNumber);
  const tooLow = hasValue && currentNumber < previous;
  const usage = hasValue && !tooLow ? currentNumber - previous : null;
  const estimate = usage !== null && latest ? usage * latest.pricePerUnit : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || tooLow) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await metersApi.record(token, kind, {
        roomId: Number(roomId),
        readingMonth: month,
        currentMeter: currentNumber,
      });
      setSuccess("บันทึกมิเตอร์สำเร็จ");
      setCurrent("");
      await loadRoomData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">จดมิเตอร์น้ำ / ไฟ</h1>

      <div className="mb-4 inline-flex rounded-lg bg-slate-200 p-1">
        {(Object.keys(KIND_LABEL) as MeterKind[]).map((k) => (
          <button
            key={k}
            onClick={() => {
              setKind(k);
              setSuccess(null);
              setError(null);
            }}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {success && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm text-slate-600">
            ห้อง
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            เดือนที่จด
            <input
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            ค่ามิเตอร์ปัจจุบัน
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm ${
                tooLow ? "border-red-400" : "border-slate-300"
              }`}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving || tooLow || !hasValue}
              className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p>
            ค่ามิเตอร์ก่อนหน้า: <b>{previous}</b>
            {latest && <> · ราคา {latest.pricePerUnit} บาท/หน่วย</>}
            {latest && !latest.hasMeter && <> (ห้องนี้ยังไม่เคยจด ใช้ราคาเริ่มต้น)</>}
          </p>
          {tooLow && (
            <p className="mt-1 font-medium text-red-600">
              ค่าปัจจุบันต้องไม่น้อยกว่าค่าก่อนหน้า ({previous})
            </p>
          )}
          {usage !== null && estimate !== null && (
            <p className="mt-1">
              ใช้ไป <b>{usage}</b> หน่วย · ประมาณ <b>{formatTHB(estimate)}</b>
            </p>
          )}
        </div>
      </form>

      <h2 className="mb-2 text-sm font-semibold text-slate-700">ประวัติ{KIND_LABEL[kind]}ของห้องนี้</h2>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">เดือน</th>
              <th className="px-4 py-3">ก่อนหน้า</th>
              <th className="px-4 py-3">ปัจจุบัน</th>
              <th className="px-4 py-3">ใช้ไป (หน่วย)</th>
              <th className="px-4 py-3">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีประวัติการจดมิเตอร์
                </td>
              </tr>
            )}
            {history.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{formatMonth(r.readingMonth)}</td>
                <td className="px-4 py-3">{Number(r.previousMeter)}</td>
                <td className="px-4 py-3">{Number(r.currentMeter)}</td>
                <td className="px-4 py-3">{Number(r.usage)}</td>
                <td className="px-4 py-3">{formatTHB(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
