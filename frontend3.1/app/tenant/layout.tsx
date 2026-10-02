"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// หน้าที่ของไฟล์: Layout กลางของทุกหน้า /tenant/* (Top nav แบบ mobile-friendly เพราะผู้เช่าส่วนใหญ่ใช้มือถือ)

const NAV_ITEMS = [
  { href: "/tenant/dashboard", label: "หน้าแรก" },
  { href: "/tenant/invoices", label: "ใบแจ้งหนี้" },
];

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    document.cookie = "accessToken=; path=/; max-age=0";
    document.cookie = "role=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-slate-900">หอพักของฉัน</span>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  pathname?.startsWith(item.href) ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button onClick={handleLogout} className="ml-2 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              ออกจากระบบ
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4">{children}</main>
    </div>
  );
}
