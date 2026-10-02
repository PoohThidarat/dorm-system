"use client";

import { useEffect, useState } from "react";
import { getCookie } from "../../../lib/cookies";
import { roomsApi } from "../../../lib/api";

// หน้าที่ของไฟล์: Admin Dashboard แสดงสรุปห้องพัก (spec ข้อ 4)
// Phase ถัดไปจะเพิ่มการ์ดการเงิน, งานซ่อม, และกราฟ ตามสเปคเต็มรูปแบบ

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<{ total: number; available: number; occupied: number; maintenance: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getCookie("accessToken");
    if (!token) return;
    roomsApi
      .summary(token)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const cards = [
    { label: "ห้องทั้งหมด", value: summary?.total, color: "bg-slate-900" },
    { label: "ห้องว่าง", value: summary?.available, color: "bg-emerald-600" },
    { label: "ห้องมีผู้เช่า", value: summary?.occupied, color: "bg-blue-600" },
    { label: "ห้องกำลังซ่อม", value: summary?.maintenance, color: "bg-amber-600" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-slate-900">แดชบอร์ด</h1>

      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className={`mb-3 h-1.5 w-10 rounded-full ${card.color}`} />
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {card.value ?? "..."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
