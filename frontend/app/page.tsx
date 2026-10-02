import { redirect } from "next/navigation";

// หน้าที่ของไฟล์: หน้า root "/" ให้ redirect ไป /login ทันที แทนที่จะเจอ 404

export default function RootPage() {
  redirect("/login");
}
