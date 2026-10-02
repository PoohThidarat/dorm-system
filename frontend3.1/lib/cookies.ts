// หน้าที่ของไฟล์: อ่านค่า cookie ฝั่ง client (ใช้ดึง accessToken ที่ตั้งไว้ตอน login)

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
