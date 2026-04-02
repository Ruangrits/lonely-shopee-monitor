# Shopee Order Monitor — Design Spec

## Context

ร้านค้าบน Shopee ต้องการ dashboard สำหรับ monitor order แบบ real-time โดยไม่ต้องเปิด Shopee Seller Centre ตลอดเวลา ระบบจะ scrape ข้อมูล order จาก Seller Centre ด้วย Playwright แล้วแสดงผลบนหน้าเว็บ Svelte 5 พร้อมเสียงแจ้งเตือนเมื่อมี order ใหม่

## Architecture

```
┌─────────────────────┐     REST API      ┌──────────────────────────┐
│   Svelte 5 App      │  ◄──────────────► │   Express Backend        │
│   (Frontend)        │                    │                          │
│                     │                    │  ┌────────────────────┐  │
│  - Dashboard        │                    │  │  Playwright Browser │  │
│  - Order cards      │                    │  │  (Persistent)       │  │
│  - Summary stats    │                    │  └─────────┬──────────┘  │
│  - Sound alert      │                    │            │             │
│  - Auto refresh     │                    │            ▼             │
│                     │                    │  Shopee Seller Centre    │
└─────────────────────┘                    │            │             │
                                           │            ▼             │
                                           │  ┌────────────────────┐  │
                                           │  │  SQLite (orders)   │  │
                                           │  └────────────────────┘  │
                                           └──────────────────────────┘
```

**Approach**: Persistent Browser Session — เปิด Playwright Chromium ค้างไว้ login ครั้งเดียว reuse session สำหรับ scraping ทุกครั้ง

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Svelte 5 (runes-only) + SvelteKit + Vite |
| UI Components | `th-lonely-universe-web-lib` (Button, Card, Text, HBox, VBox, Toast, Modal, etc.) |
| Styling | Tailwind CSS 4 + DaisyUI 5 (via lonely-web-lib theme) |
| HTTP Client | Blizzard (from lonely-web-lib) |
| Async/Error | Future / Either (from lonely-web-lib) |
| Backend | Node.js + Express + TypeScript |
| Scraper | Playwright (Chromium headless) |
| Database | SQLite via better-sqlite3 |
| Auth | Username/Password → Playwright auto-login |

## Project Location

```
/Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor/
├── frontend/
└── backend/
```

---

## Frontend

### Structure

```
frontend/src/
├── lib/
│   ├── core/
│   │   ├── services/
│   │   │   └── shopee-order-service.ts    # API client (Blizzard)
│   │   └── utils/
│   │       └── sound.ts                   # เล่นเสียงแจ้งเตือน
│   ├── app/
│   │   ├── app-context.ts                 # app-level state
│   │   └── App.svelte                     # root component
│   └── modules/
│       ├── dashboard/
│       │   ├── Dashboard.svelte           # หน้าหลัก
│       │   ├── data.ts                    # types, interfaces
│       │   └── components/
│       │       ├── OrderSummary.svelte     # การ์ดสรุปจำนวน order แยกสถานะ
│       │       ├── OrderCard.svelte        # การ์ดรายละเอียด order
│       │       ├── OrderList.svelte        # list ของ OrderCard
│       │       ├── RefreshControls.svelte  # ปุ่ม refresh + auto polling toggle + interval
│       │       └── NewOrderAlert.svelte    # เสียง + visual notification
│       └── auth/
│           ├── LoginPanel.svelte          # ฟอร์มใส่ credentials
│           └── LoginStatus.svelte         # แสดงสถานะ login
├── routes/
│   ├── +layout.svelte
│   └── +page.svelte
├── app.css
└── assets/sounds/
    └── new-order.mp3
```

### Svelte 5 Conventions (ตาม lonely-web-lib)

- **Runes only**: `$state()`, `$derived()`, `$effect()`, `$props()`
- **Snippets**: `{@render children?.()}` (ไม่ใช้ `<slot/>`)
- **Callback props**: `onclick`, `onRefresh` (ไม่ใช้ `createEventDispatcher`)
- **TypeScript strict mode**
- **Enum-driven styling** ตามแบบ lonely-web-lib

### Components

#### OrderSummary.svelte
แสดง 4 การ์ดสรุป:
- จำนวน order ทั้งหมด
- order ใหม่ (ยังไม่ดำเนินการ)
- order รอจัดส่ง
- order สำเร็จ

ใช้ `Card`, `Text`, `HBox` จาก lonely-web-lib

#### OrderCard.svelte
แสดงรายละเอียด order:
- Order ID, วันที่สั่ง
- ชื่อสินค้า, ราคา
- ชื่อผู้ซื้อ, ที่อยู่
- สถานะ (ใช้ `Chip` component)
- Badge "ใหม่!" สำหรับ order ที่เพิ่งเข้า

ใช้ `Card`, `Text`, `VBox`, `HBox`, `Chip` จาก lonely-web-lib

#### RefreshControls.svelte
- ปุ่ม refresh ด้วยมือ (`Button`)
- Toggle auto polling on/off
- Input ตั้งค่า interval (วินาที)
- แสดงเวลา scrape ล่าสุด

#### NewOrderAlert.svelte
- เมื่อ `$derived()` ตรวจพบ order ใหม่ → เล่นเสียง `new-order.mp3`
- แสดง Toast notification ผ่าน lonely-web-lib Toast

### Service Layer

```typescript
// shopee-order-service.ts
interface ShopeeOrderService {
  login(username: string, password: string): Future<ApiError, AuthStatus>
  getAuthStatus(): Future<ApiError, AuthStatus>
  getOrders(): Future<ApiError, Order[]>
  getOrderSummary(): Future<ApiError, OrderSummary>
  refreshOrders(): Future<ApiError, RefreshResult>
  setPollingInterval(seconds: number): Future<ApiError, void>
}
```

ใช้ **Blizzard** HTTP client จาก lonely-web-lib

### Types

```typescript
// data.ts
interface Order {
  id: number
  orderId: string
  productName: string
  price: number
  status: OrderStatus
  buyerName: string
  address: string
  orderDate: string
  createdAt: string
  isNew: boolean
}

enum OrderStatus {
  New = 'new',
  Processing = 'processing',
  Shipping = 'shipping',
  Delivered = 'delivered',
  Cancelled = 'cancelled'
}

interface OrderSummary {
  total: number
  new: number
  processing: number
  shipping: number
  delivered: number
}

interface AuthStatus {
  loggedIn: boolean
  shopName?: string
}

interface RefreshResult {
  newOrders: number
  totalOrders: number
  scrapedAt: string
}
```

---

## Backend

### Structure

```
backend/src/
├── index.ts                  # Express server entry point
├── scraper/
│   ├── shopee-scraper.ts     # Playwright persistent browser session
│   └── parser.ts             # parse Seller Centre HTML → Order data
├── scheduler/
│   └── poll-scheduler.ts     # setInterval-based auto polling
├── database/
│   ├── db.ts                 # better-sqlite3 connection + helpers
│   └── migrations.ts         # create tables on startup
└── routes/
    ├── auth.routes.ts        # POST /api/auth/login, GET /api/auth/status
    ├── order.routes.ts       # GET /api/orders, GET /api/orders/summary, POST /api/orders/refresh
    └── settings.routes.ts    # PATCH /api/settings/interval
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login เข้า Shopee Seller Centre (เปิด browser, navigate, login) |
| `GET` | `/api/auth/status` | เช็คว่า browser session ยัง active อยู่ไหม |
| `GET` | `/api/orders` | ดึง order ทั้งหมดจาก SQLite (query params: status, limit, offset) |
| `GET` | `/api/orders/summary` | จำนวน order แยกตามสถานะ |
| `POST` | `/api/orders/refresh` | Trigger scrape ทันที แล้ว return ผลลัพธ์ |
| `PATCH` | `/api/settings/interval` | ตั้งค่า auto polling interval (วินาที) |

### Scraper (shopee-scraper.ts)

- เปิด Playwright Chromium persistent browser context
- Login flow:
  1. Navigate ไป Shopee Seller Centre login page
  2. กรอก username/password
  3. รอ login สำเร็จ (detect dashboard page)
  4. จัดการ OTP: ถ้าเจอ OTP prompt → return status ให้ frontend แจ้งผู้ใช้ใส่เอง
- Scrape flow:
  1. Navigate ไปหน้า order list
  2. รอ order table load
  3. Extract ข้อมูลจาก DOM elements
  4. Parse ด้วย parser.ts
- Session management:
  - เก็บ browser context ไว้ในหน่วยความจำ
  - ถ้า session หมดอายุ → re-login อัตโนมัติ

### Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  product_name TEXT,
  price REAL,
  status TEXT NOT NULL DEFAULT 'new',
  buyer_name TEXT,
  address TEXT,
  order_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  is_new INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS scrape_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT DEFAULT (datetime('now')),
  status TEXT NOT NULL,
  order_count INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_new ON orders(is_new);
```

### Scheduler (poll-scheduler.ts)

- Default interval: 300 วินาที (5 นาที)
- ปรับ interval ได้ผ่าน API
- เมื่อ scrape เสร็จ:
  - เปรียบเทียบ order_id กับที่มีใน DB
  - order ใหม่ → INSERT ด้วย `is_new = 1`
  - order เก่า → UPDATE สถานะถ้าเปลี่ยน
  - บันทึก scrape_logs

### Environment Variables (.env)

```
PORT=3001
SHOPEE_USERNAME=
SHOPEE_PASSWORD=
POLLING_INTERVAL=300
DB_PATH=./data/orders.db
HEADLESS=true
```

---

## เสียงแจ้งเตือน Order ใหม่

- Frontend ใช้ `$effect()` watch ค่า `newOrderCount` จาก `$derived()`
- เมื่อ `newOrderCount` เพิ่มขึ้น → เล่นเสียง `new-order.mp3` ผ่าน `Audio` API
- แสดง `Toast` notification จาก lonely-web-lib
- ผู้ใช้ต้อง interact กับหน้าเว็บก่อนอย่างน้อย 1 ครั้ง (browser autoplay policy)

---

## Data Flow

1. ผู้ใช้เปิด frontend → กรอก Shopee credentials → `POST /api/auth/login`
2. Backend เปิด Playwright browser → login Shopee Seller Centre → return สถานะ
3. Scheduler เริ่มทำงาน → scrape orders ทุก X วินาที → บันทึกลง SQLite
4. Frontend poll `GET /api/orders` ตาม interval หรือกดปุ่ม refresh
5. เมื่อพบ order ใหม่ (is_new = 1) → แสดงการ์ดพร้อม badge + เล่นเสียง + Toast
6. ผู้ใช้เห็น order แล้ว → mark as seen (is_new = 0)

---

## Verification Plan

1. **Backend**: รัน `npm run dev` → ทดสอบ login ผ่าน API → ดู scrape log
2. **Database**: ตรวจสอบว่า orders ถูกบันทึกลง SQLite ถูกต้อง
3. **Frontend**: เปิดหน้าเว็บ → ดู dashboard → ทดสอบ refresh → ทดสอบ auto polling
4. **เสียงแจ้งเตือน**: ทดสอบว่าเสียงดังเมื่อมี order ใหม่
5. **End-to-end**: login → scrape → แสดงผล → order ใหม่เข้า → เสียงดัง + การ์ดแสดง
