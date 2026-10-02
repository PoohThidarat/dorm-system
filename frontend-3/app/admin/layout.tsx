"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// หน้าที่ของไฟล์: Layout กลางของทุกหน้า /admin/* มี Sidebar + Top Navigation (spec ข้อ 28)

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "แดชบอร์ด" },
  { href: "/admin/rooms", label: "ห้องพัก" },
  { href: "/admin/tenants", label: "ผู้เช่า" },
  { href: "/admin/contracts", label: "สัญญาเช่า" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    document.cookie = "accessToken=; path=/; max-age=0";
    document.cookie = "role=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 text-sm font-semibold text-slate-900">
          ระบบจัดการหอพัก
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                pathname?.startsWith(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">Admin Panel</span>
          <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ออกจากระบบ
          </button>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
