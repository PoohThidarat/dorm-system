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
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  const json = (await res.json()) as ApiSuccess<T> | ApiFailure;

  if (json.success === false) {
    throw new Error(json.message);
  }

  return json.data;
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
  list: (token: string) => apiFetch<Paginated<Room>>("/rooms", {}, token),
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
  list: (token: string) => apiFetch<Paginated<Tenant>>("/tenants", {}, token),
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
  list: (token: string) => apiFetch<Paginated<Contract>>("/contracts", {}, token),
  create: (
    token: string,
    input: { roomId: number; tenantId: number; startDate: string; endDate: string; deposit: number },
  ) => apiFetch<Contract>("/contracts", { method: "POST", body: JSON.stringify(input) }, token),
  terminate: (token: string, id: number) =>
    apiFetch<Contract>(`/contracts/${id}/terminate`, { method: "POST" }, token),
};
