# Shopee Monitor — Cleanup & Refactor Spec

## Context

โปรเจค lonely-shopee-monitor ถูกสร้างขึ้นมาอย่างรวดเร็ว ทำให้มี dead code, logic ซ้ำซ้อน, และ service ที่ไม่ครบ ต้อง cleanup เพื่อให้โค้ดสะอาดและ maintain ได้ง่ายขึ้น

## ขอบเขต

Cleanup เท่านั้น — ไม่เปลี่ยนโครงสร้างใหญ่, ไม่เพิ่มฟีเจอร์ใหม่

---

## 1. ลบ Dead Code

### Backend

| ไฟล์ | Action | เหตุผล |
|------|--------|--------|
| `src/database/db.ts` | ลบ | ไม่ได้ใช้ เปลี่ยนเป็น JSON cache |
| `src/database/migrations.ts` | ลบ | ไม่ได้ใช้ |
| `src/database/` directory | ลบ | ว่างแล้ว |
| `shopee-scraper.ts` → `discoverApis()` | ลบ method | ใช้แค่ debug ครั้งเดียว |
| `shopee-scraper.ts` → `screenshot()` | ลบ method | ไม่ได้เรียกจากที่ไหน |
| `shopee-scraper.ts` → `scrapeFromPage()` | ลบ method | DOM fallback ไม่จำเป็นแล้ว (API ทำงานได้) |
| `shopee-scraper.ts` → `scrapeTabOrders()` | ลบ method | ใช้กับ scrapeFromPage |
| `shopee-scraper.ts` → `scrapeDetailPage()` | ลบ method | ใช้กับ scrapeFromPage |
| `shopee-scraper.ts` → `parseSummaryFromTabs()` | ลบ method | ใช้กับ scrapeFromPage |
| `package.json` → `better-sqlite3` | ลบ dependency | ไม่ได้ใช้แล้ว |
| `package.json` → `@types/better-sqlite3` | ลบ dependency | ไม่ได้ใช้แล้ว |

### Frontend

| ไฟล์ | Action | เหตุผล |
|------|--------|--------|
| `src/lib/modules/auth/LoginPanel.svelte` | ลบ | ไม่ได้ใช้ login จาก .env |
| `src/lib/modules/auth/` directory | ลบ (เหลือแค่ LoginStatus) | ย้าย LoginStatus ไปที่อื่น |
| `src/lib/modules/dashboard/components/OrderList.svelte` | ลบ | ไม่ได้ใช้ + มี bug (order.id ≠ order.orderId) |
| `src/lib/core/utils/sound.ts` | ลบ | NewOrderAlert ไม่เคยเล่นเสียงจริง (ไม่มีไฟล์เสียง) |
| `src/lib/modules/dashboard/components/NewOrderAlert.svelte` | ลบ | ไม่ทำงาน (ไม่มีไฟล์เสียง, logic ไม่ถูกต้อง) |

## 2. แก้ Bug

### Frontend Service ไม่ครบ

`src/lib/core/services/shopee-order-service.ts` ขาด method ที่ถูกเรียกจาก components:

- เพิ่ม `setPollingInterval(seconds)` — เรียกจาก `RefreshControls.svelte:37`

### ลบ method ที่ไม่มี backend route รองรับ

- RefreshControls.svelte เรียก `shopeeOrderService.setPollingInterval()` แต่ backend route ใช้ `PATCH /api/settings/interval` → เพิ่ม method ใน service ที่เรียก endpoint นี้

## 3. Cleanup Logic ซ้ำ

### รวม auto-login logic

ตอนนี้ auto-login อยู่ 2 ที่:
- `auth.routes.ts` → `GET /api/auth/status`
- `poll-scheduler.ts` → `scrapeAndSave()`

**แก้ไข**: ลบ auto-login ออกจาก `poll-scheduler.ts` ให้ `auth.routes.ts` เป็นที่เดียวที่ทำ auto-login เมื่อ frontend เรียก `/api/auth/status` ตอนเริ่มต้น

## 4. ลบไฟล์ debug

- `data/screenshots/` — ลบไฟล์ screenshots ทั้งหมด (debug files)
- `data/screenshots/api-discovery.json` — ลบ
- `data/screenshots/page-text.txt` — ลบ
- เพิ่ม `data/screenshots/` ใน `.gitignore`

---

## ผลลัพธ์ที่คาดหวัง

| Metric | ก่อน | หลัง |
|--------|------|------|
| Backend source lines | ~950 | ~550 |
| Frontend source lines | ~640 | ~450 |
| Dead code files | 6 | 0 |
| Dead methods in scraper | 5+ | 0 |
| Unused npm packages | 2 | 0 |

## Verification

1. `npx tsc --noEmit` — ไม่มี error
2. `npm run build` (frontend) — build ผ่าน
3. `curl POST /api/orders/refresh` — ยังดึงข้อมูลได้ถูกต้อง
4. เปิดหน้าเว็บ → กด Refresh → แสดง order cards ได้
