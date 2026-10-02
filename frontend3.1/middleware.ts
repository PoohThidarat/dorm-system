import { NextRequest, NextResponse } from "next/server";

// หน้าที่ของไฟล์: ป้องกันไม่ให้ User เข้าถึง URL ที่ไม่มีสิทธิ์ (spec ข้อ 3)
// ตรวจสอบ role จาก cookie (ที่ตั้งตอน login) ก่อนปล่อยให้เข้าแต่ละ route group
// หมายเหตุ: middleware นี้เช็คเบื้องต้นฝั่ง UX เท่านั้น ตัว Backend API ยังคง
// เป็นด่านความปลอดภัยจริงผ่าน authenticate + requireRole เสมอ

const ROUTE_ROLE_MAP: Record<string, string[]> = {
  "/admin": ["SUPER_ADMIN", "ADMIN"],
  "/tenant": ["TENANT"],
  "/technician": ["TECHNICIAN"],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const matchedPrefix = Object.keys(ROUTE_ROLE_MAP).find((p) => pathname.startsWith(p));

  if (!matchedPrefix) return NextResponse.next();

  const accessToken = req.cookies.get("accessToken")?.value;
  const role = req.cookies.get("role")?.value;

  if (!accessToken || !role) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const allowedRoles = ROUTE_ROLE_MAP[matchedPrefix];
  if (!allowedRoles.includes(role)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tenant/:path*", "/technician/:path*"],
};
