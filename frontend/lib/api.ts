// หน้าที่ของไฟล์: Wrapper สำหรับเรียก Backend REST API พร้อมแนบ Access Token
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

interface ApiSuccess<T> {
  success: true;
  data: T;
}
interface ApiFailure {
  success: false;
  message: string;
  errorCode: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (!json.success) {
    throw new Error(json.message);
  }

  return json.data;
}

// ดึงไฟล์แบบไบนารี (สลิป, ใบเสร็จ PDF) พร้อมแนบ token — endpoint พวกนี้ไม่เปิดสาธารณะ
export async function apiBlob(path: string, accessToken: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    let message = "ดาวน์โหลดไฟล์ไม่สำเร็จ";
    try {
      message = ((await res.json()) as ApiFailure).message ?? message;
    } catch {
      /* ไม่ใช่ JSON */
    }
    throw new Error(message);
  }
  return res.blob();
}

export function login(email: string, password: string) {
  return apiFetch<{
    accessToken: string;
    refreshToken: string;
    user: { id: number; email: string; firstName: string; lastName: string; role: string };
  }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

// ---------------------------------------------------------------------
// Types (Phase 2)
// ---------------------------------------------------------------------

export interface RoomType {
  id: number;
  name: string;
}

export type RoomStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "INACTIVE";

export interface Room {
  id: number;
  roomNumber: string;
  floor: number;
  roomTypeId: number;
  roomType: RoomType;
  monthlyRent: string;
  deposit: string;
  status: RoomStatus;
  description?: string | null;
}

export interface Tenant {
  id: number;
  nationalId: string;
  address?: string | null;
  status: "ACTIVE" | "INACTIVE" | "MOVED_OUT";
  user: { id: number; email: string; firstName: string; lastName: string; phone?: string | null };
  contracts: { id: number; room: Room }[];
}

export interface Contract {
  id: number;
  roomId: number;
  tenantId: number;
  startDate: string;
  endDate: string;
  deposit: string;
  status: "ACTIVE" | "EXPIRED" | "TERMINATED";
  room: Room;
  tenant: Tenant;
}

interface Paginated<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ---------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------

export const roomsApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Room>>(`/rooms${qs}`, {}, token),
  summary: (token: string) =>
    apiFetch<{ total: number; available: number; occupied: number; maintenance: number }>(
      "/rooms/summary",
      {},
      token,
    ),
  create: (
    token: string,
    input: { roomNumber: string; floor: number; roomTypeId: number; monthlyRent: number; deposit: number; description?: string },
  ) => apiFetch<Room>("/rooms", { method: "POST", body: JSON.stringify(input) }, token),
  changeStatus: (token: string, id: number, status: RoomStatus) =>
    apiFetch<Room>(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
  remove: (token: string, id: number) => apiFetch(`/rooms/${id}`, { method: "DELETE" }, token),
};

export const roomTypesApi = {
  list: (token: string) => apiFetch<RoomType[]>("/room-types", {}, token),
  create: (token: string, name: string) =>
    apiFetch<RoomType>("/room-types", { method: "POST", body: JSON.stringify({ name }) }, token),
};

// ---------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------

export const tenantsApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Tenant>>(`/tenants${qs}`, {}, token),
  create: (
    token: string,
    input: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      phone?: string;
      nationalId: string;
      address?: string;
    },
  ) => apiFetch<Tenant>("/tenants", { method: "POST", body: JSON.stringify(input) }, token),
  moveRoom: (token: string, id: number, newRoomId: number) =>
    apiFetch<Contract>(`/tenants/${id}/move-room`, { method: "POST", body: JSON.stringify({ newRoomId }) }, token),
  cancelRental: (token: string, id: number) =>
    apiFetch<Contract>(`/tenants/${id}/cancel-rental`, { method: "POST" }, token),
  remove: (token: string, id: number) => apiFetch(`/tenants/${id}`, { method: "DELETE" }, token),
};

// ---------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------

export const contractsApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Contract>>(`/contracts${qs}`, {}, token),
  create: (
    token: string,
    input: { roomId: number; tenantId: number; startDate: string; endDate: string; deposit: number },
  ) => apiFetch<Contract>("/contracts", { method: "POST", body: JSON.stringify(input) }, token),
  terminate: (token: string, id: number) =>
    apiFetch<Contract>(`/contracts/${id}/terminate`, { method: "POST" }, token),
};

// ---------------------------------------------------------------------
// Meters & Invoices (Phase 3)
// ---------------------------------------------------------------------

export type MeterKind = "water" | "electricity";

export interface MeterReading {
  id: number;
  previousMeter: string;
  currentMeter: string;
  usage: string;
  total: string;
  readingMonth: string;
  meter: { pricePerUnit: string; room: { id: number; roomNumber: string } };
}

export interface MeterLatest {
  hasMeter: boolean;
  previousMeter: number;
  pricePerUnit: number;
  lastReadingMonth: string | null;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  id: number;
  invoiceNumber: string;
  contractId: number;
  billingMonth: string;
  rent: string;
  water: string;
  electricity: string;
  otherCharges: string;
  discount: string;
  fine: string;
  total: string;
  dueDate: string;
  status: InvoiceStatus;
  items: { id: number; label: string; amount: string }[];
  payments: { id: number; amount: string; status: PaymentStatus }[];
  contract: {
    room: { id: number; roomNumber: string };
    tenant: { id: number; user: { firstName: string; lastName: string } };
  };
}

export interface GenerateMonthlyResult {
  createdCount: number;
  created: string[];
  skipped: { contractId: number; roomNumber: string; reason: string }[];
  missingReadings: { roomNumber: string; water: boolean; electricity: boolean }[];
}

export const metersApi = {
  latest: (token: string, kind: MeterKind, roomId: number) =>
    apiFetch<MeterLatest>(`/meters/${kind}/latest?roomId=${roomId}`, {}, token),
  history: (token: string, kind: MeterKind, roomId: number) =>
    apiFetch<Paginated<MeterReading>>(`/meters/${kind}/readings?roomId=${roomId}&pageSize=24`, {}, token),
  record: (
    token: string,
    kind: MeterKind,
    input: { roomId: number; readingMonth: string; currentMeter: number },
  ) => apiFetch<MeterReading>(`/meters/${kind}/readings`, { method: "POST", body: JSON.stringify(input) }, token),
};

export const invoicesApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Invoice>>(`/invoices${qs}`, {}, token),
  mine: (token: string, qs = "") => apiFetch<Paginated<Invoice>>(`/invoices/my${qs}`, {}, token),
  create: (
    token: string,
    input: {
      contractId: number;
      billingMonth: string;
      discount?: number;
      otherCharges?: { label: string; amount: number }[];
      issue?: boolean;
    },
  ) =>
    apiFetch<{ invoice: Invoice; missingReadings: { water: boolean; electricity: boolean } }>(
      "/invoices",
      { method: "POST", body: JSON.stringify(input) },
      token,
    ),
  generateMonthly: (token: string, billingMonth: string) =>
    apiFetch<GenerateMonthlyResult>(
      "/invoices/generate-monthly",
      { method: "POST", body: JSON.stringify({ billingMonth }) },
      token,
    ),
  issue: (token: string, id: number) => apiFetch<Invoice>(`/invoices/${id}/issue`, { method: "POST" }, token),
  cancel: (token: string, id: number) => apiFetch<Invoice>(`/invoices/${id}/cancel`, { method: "POST" }, token),
};

// ---------------------------------------------------------------------
// Payments & Receipts (Phase 4)
// ---------------------------------------------------------------------

export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "QR_PAYMENT" | "ONLINE";

export interface Payment {
  id: number;
  invoiceId: number;
  amount: string;
  paymentDate: string;
  method: PaymentMethod;
  referenceNumber?: string | null;
  status: PaymentStatus;
  rejectReason?: string | null;
  createdAt: string;
  slips: { id: number; filePath: string }[];
  receipt?: { id: number; receiptNumber: string } | null;
  invoice: {
    id: number;
    invoiceNumber: string;
    billingMonth: string;
    total: string;
    status: InvoiceStatus;
    contract: {
      room: { id: number; roomNumber: string };
      tenant: { id: number; user: { firstName: string; lastName: string } };
    };
  };
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  issuedAt: string;
  payment: {
    amount: string;
    method: PaymentMethod;
    paymentDate: string;
    referenceNumber?: string | null;
    invoice: {
      invoiceNumber: string;
      billingMonth: string;
      contract: {
        room: { id: number; roomNumber: string };
        tenant: { id: number; user: { firstName: string; lastName: string } };
      };
    };
  };
}

export const paymentsApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Payment>>(`/payments${qs}`, {}, token),
  mine: (token: string, qs = "") => apiFetch<Paginated<Payment>>(`/payments/my${qs}`, {}, token),
  // ผู้เช่าแจ้งชำระ: ส่งเป็น FormData (field "slip" = ไฟล์รูปสลิป)
  submit: (token: string, form: FormData) =>
    apiFetch<Payment>("/payments", { method: "POST", body: form }, token),
  // Admin บันทึกรับชำระเอง (อนุมัติ + ออกใบเสร็จทันที)
  record: (
    token: string,
    input: { invoiceId: number; amount: number; method: PaymentMethod; paymentDate?: string; referenceNumber?: string },
  ) =>
    apiFetch<{ invoiceStatus: InvoiceStatus }>("/payments/record", { method: "POST", body: JSON.stringify(input) }, token),
  approve: (token: string, id: number) =>
    apiFetch<{ invoiceStatus: InvoiceStatus }>(`/payments/${id}/approve`, { method: "POST" }, token),
  reject: (token: string, id: number, reason: string) =>
    apiFetch<Payment>(`/payments/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }, token),
  slip: (token: string, id: number) => apiBlob(`/payments/${id}/slip`, token),
};

export const receiptsApi = {
  list: (token: string, qs = "") => apiFetch<Paginated<Receipt>>(`/receipts${qs}`, {}, token),
  mine: (token: string, qs = "") => apiFetch<Paginated<Receipt>>(`/receipts/my${qs}`, {}, token),
  pdf: (token: string, id: number, download = false) =>
    apiBlob(`/receipts/${id}/pdf${download ? "?download=1" : ""}`, token),
};
