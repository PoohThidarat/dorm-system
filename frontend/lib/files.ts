// หน้าที่ของไฟล์: เปิด/ดาวน์โหลดไฟล์ที่ต้องแนบ token (สลิป, ใบเสร็จ PDF)
// เปิดแท็บใหม่ "ก่อน" รอไฟล์ เพื่อไม่ให้เบราว์เซอร์บล็อก popup (การเรียก window.open หลัง await มักถูกบล็อก)

export async function openBlobInNewTab(getBlob: () => Promise<Blob>): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await getBlob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

export async function downloadBlob(getBlob: () => Promise<Blob>, filename: string): Promise<void> {
  const url = URL.createObjectURL(await getBlob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
