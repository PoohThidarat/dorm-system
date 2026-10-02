# ระบบบริหารจัดการหอพักและแจ้งซ่อม (Dormitory Management & Maintenance System)

สถานะปัจจุบัน: **Phase 3 — Invoice / Water / Electricity Billing** (Phase 1-2 เสร็จสมบูรณ์แล้ว)

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

### Phase 3 — Invoice / Water / Electricity Billing
- **มิเตอร์น้ำ/ไฟ**: จดรายเดือน, `Usage = Current - Previous`, `Total = Usage × ราคาต่อหน่วย`, ปฏิเสธ Current < Previous, กันจดซ้ำเดือนเดียวกัน, กันจดย้อนหลังข้ามเดือนที่ใหม่กว่า, ราคาต่อหน่วยตั้งรายห้องได้ (ค่าเริ่มต้นจาก `.env`), ดูประวัติย้อนหลัง
- **ใบแจ้งหนี้**: ค่าเช่า + น้ำ + ไฟ + ค่าอื่น ๆ − ส่วนลด + ค่าปรับ, เลขบิล `INV-YYYYMM-NNNN`, สถานะ DRAFT/ISSUED/UNPAID/PARTIAL/PAID/OVERDUE/CANCELLED
- **Business rules**: ไม่มี Active Contract สร้างบิลไม่ได้ (rule #2), ห้ามบิลซ้ำเดือนเดียวกัน (rule #3 — บังคับทั้งใน service และ DB unique), แก้ไขได้เฉพาะ DRAFT, ยกเลิกไม่ได้ถ้า PAID หรือมี payment ที่อนุมัติแล้ว, ผู้เช่าเห็นเฉพาะบิลของตัวเองและไม่เห็น DRAFT (rule #7)
- **ออกบิลอัตโนมัติ** (node-cron, เวลา Asia/Bangkok): วันที่ 1 ของเดือน 01:00 ออกบิล *ของเดือนที่แล้ว* ให้ทุกสัญญา Active และรายงานห้องที่ยังไม่จดมิเตอร์; ทุกวัน 02:00 อัปเดตบิลเลยกำหนดเป็น OVERDUE + คำนวณค่าปรับ (1%/วัน สูงสุด 30% — คิดซ้ำกี่ครั้งก็ได้ผลเท่าเดิม) ปิดได้ด้วย `BILLING_SCHEDULER_ENABLED=false`
- Admin UI: จดมิเตอร์ (แสดงค่าก่อนหน้า/ตัวอย่างยอดก่อนบันทึก), ใบแจ้งหนี้ (ค้นหา/กรอง, ออกบิลรายเดือน, สร้างรายห้อง, ออก/ยกเลิก, ขยายดูรายการ)
- Tenant UI: หน้าแรก (ยอดค้างชำระ), ใบแจ้งหนี้ของตัวเอง

> **ข้อกำหนดการใช้งานบิล**: "เดือนบิล" = เดือนเดียวกับเดือนที่จดมิเตอร์ (เช่น จดมิเตอร์เดือน 09 → ออกบิลเดือน 09 → ครบกำหนด 5 ต.ค.) ดังนั้นควรจดมิเตอร์ให้เสร็จก่อนวันที่ 1 ของเดือนถัดไป

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
npx prisma migrate dev --name init     # ครั้งแรก
npm run prisma:generate
```

**อัปเกรดจาก Phase 2 → Phase 3**: schema เพิ่ม unique constraint (1 มิเตอร์ต่อห้อง, จดมิเตอร์ไม่ซ้ำเดือน) ต้องสร้าง migration ใหม่

```bash
npm install                                        # ติดตั้ง node-cron / supertest เพิ่ม
npx prisma migrate dev --name billing_constraints
npm run prisma:seed                                # seed รันซ้ำได้ปลอดภัย (upsert) — เพิ่มสัญญา/มิเตอร์/บิลตัวอย่าง
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
npm run test          # Unit + Integration (route/RBAC) — ไม่ต้องต่อ DB
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

### Meters (Phase 3) — `:kind` = `water` | `electricity`
| Method | Endpoint | Role |
|---|---|---|
| POST | /api/meters/:kind/readings | SUPER_ADMIN, ADMIN |
| GET | /api/meters/:kind/readings?roomId= | SUPER_ADMIN, ADMIN |
| GET | /api/meters/:kind/latest?roomId= | SUPER_ADMIN, ADMIN |
| PUT | /api/meters/:kind/rooms/:roomId/price | SUPER_ADMIN, ADMIN |
| GET | /api/meters/my/:kind/readings | TENANT (เฉพาะห้องของตัวเอง) |

### Invoices (Phase 3)
| Method | Endpoint | Role |
|---|---|---|
| GET | /api/invoices?status=&billingMonth=YYYY-MM&search= | SUPER_ADMIN, ADMIN |
| POST | /api/invoices | SUPER_ADMIN, ADMIN |
| POST | /api/invoices/generate-monthly | SUPER_ADMIN, ADMIN |
| GET | /api/invoices/my | TENANT |
| GET | /api/invoices/:id | SUPER_ADMIN, ADMIN, TENANT (เฉพาะบิลตัวเอง) |
| PUT | /api/invoices/:id (เฉพาะ DRAFT) | SUPER_ADMIN, ADMIN |
| POST | /api/invoices/:id/issue | SUPER_ADMIN, ADMIN |
| POST | /api/invoices/:id/cancel | SUPER_ADMIN, ADMIN |

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
    utils/        jwt, password, apiResponse, pagination, billing.util (สูตรคำนวณบิล), date.util
    services/billing-scheduler.ts  ← cron ออกบิลรายเดือน + ค่าปรับรายวัน
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
      meters/page.tsx, invoices/page.tsx
    tenant/  layout + dashboard + invoices
    technician/  ← โครงไว้สำหรับ Phase ถัดไป
  lib/api.ts      ← typed fetch client (auth, rooms, tenants, contracts)
  lib/cookies.ts
  middleware.ts   ← RBAC route guard ฝั่ง frontend
```

## Roadmap (Phase ถัดไป)
4. Payment / Receipt
5. Maintenance Ticket + Technician Workflow
6. Notification + LINE Integration
7. Dashboard (การเงิน/งานซ่อม/กราฟ) + Reports + Export
8. Automated Testing (เพิ่มเติม: integration test ต่อ DB จริงผ่าน supertest)
9. Security Hardening + Audit Log
10. CI/CD + Deployment

> Prisma schema ครอบคลุมทุกตารางที่ Phase 3-9 ต้องใช้แล้ว Phase ถัดไปจะเน้นเขียน
> service/controller/route/UI เพิ่มเท่านั้น ไม่ต้องแก้ schema มาก ยกเว้นเพิ่ม index/constraint ตามจริง
