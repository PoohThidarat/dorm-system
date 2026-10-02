import type { Metadata } from "next";
import "./globals.css";

// หน้าที่ของไฟล์: Root Layout ที่ Next.js App Router ต้องมีเสมอ (ครอบทุกหน้าในแอป)

export const metadata: Metadata = {
  title: "ระบบบริหารจัดการหอพัก",
  description: "Dormitory Management & Maintenance System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
