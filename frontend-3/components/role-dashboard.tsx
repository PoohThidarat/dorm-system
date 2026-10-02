"use client";

import { useRouter } from "next/navigation";

interface RoleDashboardProps {
  title: string;
  description: string;
}

export default function RoleDashboard({ title, description }: RoleDashboardProps) {
  const router = useRouter();

  function handleLogout() {
    document.cookie = "accessToken=; path=/; max-age=0";
    document.cookie = "role=; path=/; max-age=0";
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <span className="text-sm font-semibold text-slate-900">ระบบจัดการหอพัก</span>
        <button
          onClick={handleLogout}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ออกจากระบบ
        </button>
      </header>
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </section>
    </main>
  );
}
