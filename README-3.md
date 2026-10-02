# ระบบบริหารจัดการหอพักและแจ้งซ่อม (Dormitory Management & Maintenance System)

สถานะปัจจุบัน: **Phase 2 — Room / Tenant / Contract Management** (Phase 1 เสร็จสมบูรณ์แล้ว)

## Overview
Full-stack web app สำหรับบริหารหอพัก: ห้องพัก, ผู้เช่า, สัญญาเช่า, ค่าเช่า/น้ำ/ไฟ, การชำระเงิน,
และระบบแจ้งซ่อมพร้อม workflow ช่าง ↔ ผู้เช่า ↔ แอดมิน แบบครบวงจร

## Features
### Phase 1 — Auth & RBAC
- Login / Logout, Register (เฉพาะ SUPER_ADMIN), Forgot/Reset/Change Password
- JWT Access + Refresh Token (revoke ตอน logout, detect refresh token reuse)
- Role-Based Access Control: SUPER_ADMIN, ADMIN, TENANT, TECHNICIAN
- Route guard ฝั่ง Next.js middleware + ฝั่ง API (`authenticate` + `requireRole`)
- Global error handler มาตรฐาน + Prisma schema ครบ 26 ตาราง

### Phase 2 — Room / Tenant / Contract Management
- **Room**: CRUD, ประเภทห้อง (Room Type), เปลี่ยนสถานะแบบมี state-machine ป้องกันการเปลี่ยนผิด flow, dashboard summary, ป้องกันลบห้องที่มีสัญญา Active, search/filter/sort/pagination
- **Tenant**: สร้าง User+Tenant พร้อมกันแบบ transaction, กันอีเมล/เลขบัตรประชาชนซ้ำ, ย้ายห้อง, ยกเลิกการเช่า, soft delete
- **Contract**: ตรวจห้องว่างก่อนสร้างสัญญา, 1 ผู้เช่ามีสัญญา Active ได้ 1 สัญญา, อัปโหลด PDF สัญญา (multer จำกัดชนิด/ขนาดไฟล์), terminate/moveRoom ที่ sync สถานะห้อง+ผู้เช่าอัตโนมัติ, query หาสัญญาใกล้หมดอายุ (เตรียมไว้ให้ Notification ใน Phase 6)
- Admin UI: Dashboard (สรุปห้อง), หน้า Rooms/Tenants/Contracts แบบ list + create form + action

## Tech Stack
- Frontend: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, TypeScript, Prisma ORM
- Database: MySQL
- Auth: JWT + bcrypt + RBAC
- File upload: Multer (Contract PDF / Payment Slip / Maintenance Images)
- Testing: Jest (unit), Playwright (E2E)

## Installation

```bash
# Backend
cd backend
cp .env.example .env   # แก้ค่าตามเครื่องตัวเอง
npm install

# Frontend
cd ../frontend
cp .env.example .env.local   # ปกติค่า default ใช้ได้เลยถ้า backend รันที่ localhost:4000
npm install
```

## Environment Variables
ดูตัวอย่างที่ `backend/.env.example` — ต้องตั้งอย่างน้อย `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

## Database Setup & Migration

```bash
cd backend
npx prisma migrate dev --name init
npm run prisma:generate
```

## Seed Data

```bash
npm run prisma:seed
```

สร้าง demo user + ข้อมูลตัวอย่าง:

| Email | Password | Role |
|---|---|---|
| admin@example.com | Password123! | SUPER_ADMIN |
| tenant@example.com | Password123! | TENANT |
| tenant1@example.com ... tenant15@example.com | Password123! | TENANT |
| technician@example.com | Password123! | TECHNICIAN |

พร้อมห้องพัก 20 ห้อง (2 ประเภท: มาตรฐาน/ดีลักซ์) ตามสเปคข้อ 33

## Run Development

```bash
# Terminal 1
cd backend && npm run dev      # http://localhost:4000

# Terminal 2
cd frontend && npm run dev     # http://localhost:3000
```

## Run Test

```bash
cd backend
npm run test          # Unit test
npm run test:e2e      # Playwright E2E (ต้องรัน dev server ไว้ก่อน)
```

## Build

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm start
```

## API

### Auth (Phase 1)
| Method | Endpoint | Auth | Role |
|---|---|---|---|
| POST | /api/auth/login | - | Public |
| POST | /api/auth/refresh | - | Public |
| POST | /api/auth/register | ✓ | SUPER_ADMIN |
| POST | /api/auth/logout | ✓ | Any |
| POST | /api/auth/forgot-password | - | Public |
| POST | /api/auth/reset-password | - | Public |
| POST | /api/auth/change-password | ✓ | Any |
| GET | /api/auth/me | ✓ | Any |

### Rooms (Phase 2)
| Method | Endpoint | Role |
|---|---|---|
| GET | /api/rooms | SUPER_ADMIN, ADMIN |
| GET | /api/rooms/summary | SUPER_ADMIN, ADMIN |
| POST | /api/rooms | SUPER_ADMIN, ADMIN |
| GET | /api/rooms/:id | SUPER_ADMIN, ADMIN |
| PUT | /api/rooms/:id | SUPER_ADMIN, ADMIN |
| PATCH | /api/rooms/:id/status | SUPER_ADMIN, ADMIN |
| DELETE | /api/rooms/:id | SUPER_ADMIN, ADMIN |
| GET / POST | /api/room-types | SUPER_ADMIN, ADMIN |

### Tenants (Phase 2)
| Method | Endpoint | Role |
|---|---|---|
| GET | /api/tenants | SUPER_ADMIN, ADMIN |
| POST | /api/tenants | SUPER_ADMIN, ADMIN |
| GET | /api/tenants/:id | SUPER_ADMIN, ADMIN |
| PUT | /api/tenants/:id | SUPER_ADMIN, ADMIN |
| POST | /api/tenants/:id/move-room | SUPER_ADMIN, ADMIN |
| POST | /api/tenants/:id/cancel-rental | SUPER_ADMIN, ADMIN |
| DELETE | /api/tenants/:id | SUPER_ADMIN, ADMIN |

### Contracts (Phase 2)
| Method | Endpoint | Role |
|---|---|---|
| GET | /api/contracts | SUPER_ADMIN, ADMIN |
| POST | /api/contracts | SUPER_ADMIN, ADMIN |
| GET | /api/contracts/:id | SUPER_ADMIN, ADMIN |
| PUT | /api/contracts/:id | SUPER_ADMIN, ADMIN |
| POST | /api/contracts/:id/terminate | SUPER_ADMIN, ADMIN |
| POST | /api/contracts/:id/pdf (multipart, field "file") | SUPER_ADMIN, ADMIN |

> List endpoint ทั้งหมดรองรับ query: `?search=&page=&pageSize=&sortBy=&sortOrder=` (spec ข้อ 21)

## Project Structure

```
backend/
  prisma/schema.prisma   ← ER model ทั้งหมด (26 ตาราง)
  prisma/seed.ts         ← Role, demo users, 20 ห้อง, 15 ผู้เช่า
  uploads/               ← ไฟล์ที่ผู้ใช้อัปโหลด (contracts, payment-slips, maintenance) — เสิร์ฟผ่าน /uploads
  src/
    config/       env, prisma client
    controllers/  HTTP layer (auth, room, tenant, contract)
    services/     business logic
    repositories/ Prisma queries เท่านั้น
    middlewares/  auth, rbac, error handler, upload (multer)
    routes/       Express routers
    validators/   zod schemas
    utils/        jwt, password, apiResponse, pagination
  tests/{unit,integration,e2e}

frontend/
  app/
    layout.tsx, page.tsx, globals.css   ← root shell (redirect / → /login)
    login/page.tsx
    admin/
      layout.tsx        ← sidebar + top nav
      dashboard/page.tsx
      rooms/page.tsx
      tenants/page.tsx
      contracts/page.tsx
    tenant/, technician/  ← โครงไว้สำหรับ Phase ถัดไป
  lib/api.ts      ← typed fetch client (auth, rooms, tenants, contracts)
  lib/cookies.ts
  middleware.ts   ← RBAC route guard ฝั่ง frontend
```

## Roadmap (Phase ถัดไป)
3. Invoice / Water / Electricity Billing
4. Payment / Receipt
5. Maintenance Ticket + Technician Workflow
6. Notification + LINE Integration
7. Dashboard (การเงิน/งานซ่อม/กราฟ) + Reports + Export
8. Automated Testing (เพิ่มเติม: integration test ต่อ DB จริงผ่าน supertest)
9. Security Hardening + Audit Log
10. CI/CD + Deployment

> Prisma schema ครอบคลุมทุกตารางที่ Phase 3-9 ต้องใช้แล้ว Phase ถัดไปจะเน้นเขียน
> service/controller/route/UI เพิ่มเท่านั้น ไม่ต้องแก้ schema มาก ยกเว้นเพิ่ม index/constraint ตามจริง
