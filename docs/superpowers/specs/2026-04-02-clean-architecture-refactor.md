# Backend Clean Architecture Refactor — Multi-Platform Ready

## Context

Backend ปัจจุบันมี god class (`shopee-scraper.ts` 401 บรรทัด) ที่ทำทุกอย่าง: browser automation, API calls, data parsing, session management ทำให้ยากต่อการ test, maintain, และขยาย

ต้อง refactor เป็น Clean Architecture เพื่อ:
1. แยก responsibility ตาม Single Responsibility Principle
2. รองรับ multi-platform (Shopee x2, Lazada x1, TikTok x1) ในอนาคต
3. ให้ domain layer เป็น platform-agnostic

## Architecture Overview

```
src/
├── domain/              ← Entity Layer (pure, no external deps)
├── usecases/            ← Use Case Layer (orchestration)
├── infrastructure/      ← Infrastructure Layer (platform-specific)
├── routes/              ← Interface Adapter Layer (HTTP)
└── index.ts             ← Bootstrap + Dependency Injection
```

**Dependency Rule**: domain ← usecases ← infrastructure/routes ← index.ts

---

## Domain Layer (`domain/`)

ไม่ import อะไรจาก layer อื่น — pure TypeScript types, interfaces, business rules

### `domain/entities/order.ts`

```typescript
export interface OrderItem {
  productName: string
  variant: string
  quantity: number
  imageUrl: string
}

export interface Order {
  orderId: string
  buyerName: string
  orderTime: string
  items: OrderItem[]
  status: string
}

export interface OrderSummary {
  unpaid: number
  toShip: number
  toShipUnprocessed: number
  toShipProcessed: number
  shipping: number
  completed: number
  cancelled: number
}

export interface ScrapeResult {
  summary: OrderSummary
  toShipOrders: Order[]
  shippingOrders: Order[]
}
```

### `domain/entities/account.ts`

```typescript
export enum Platform {
  Shopee = 'shopee',
  Lazada = 'lazada',
  TikTok = 'tiktok',
}

export interface Account {
  id: string          // "shopee-lonely", "lazada-main"
  platform: Platform
  name: string        // display name
  credentials: {
    username: string
    password: string
  }
}
```

### `domain/ports/auth-gateway.port.ts`

```typescript
export interface AuthGateway {
  launch(): Promise<void>
  login(username: string, password: string): Promise<AuthResult>
  waitForVerification(): Promise<{ success: boolean; error?: string }>
  isActive(): boolean
  close(): Promise<void>
}

export interface AuthResult {
  success: boolean
  needsVerification: boolean
  error?: string
}
```

### `domain/ports/order-gateway.port.ts`

```typescript
export interface OrderGateway {
  fetchSummary(): Promise<OrderSummary>
  fetchOrders(tab: number): Promise<Order[]>
  fetchAll(): Promise<ScrapeResult>
}
```

### `domain/ports/cache.port.ts`

```typescript
export interface CachePort<T> {
  load(): T | null
  save(data: T): void
}
```

### `domain/services/change-detector.ts`

ย้ายจาก `poll-scheduler.ts` → `summaryChanged()` เป็น pure function

---

## Use Case Layer (`usecases/`)

Import domain เท่านั้น รับ dependencies ผ่าน constructor/parameter

### `usecases/check-auth.usecase.ts`

- รับ `AuthGateway` ผ่าน constructor
- `execute()`: เช็ค `isActive()` → ถ้าไม่ active → `launch()` → `login()` → return status
- ไม่รู้จัก Shopee/Lazada/TikTok — รู้แค่ `AuthGateway` interface

### `usecases/fetch-orders.usecase.ts`

- รับ `OrderGateway` + `CachePort` ผ่าน constructor
- `execute()`: เรียก `gateway.fetchAll()` → เปรียบเทียบกับ cache → save ถ้าเปลี่ยน → return result
- `getCached()`: return cached result ทันที

### `usecases/manage-polling.usecase.ts`

- รับ `FetchOrdersUseCase` + scheduler ผ่าน constructor
- `start()`, `stop()`, `setInterval()`, `getStatus()`

---

## Infrastructure Layer (`infrastructure/`)

Implement interfaces จาก domain — platform-specific code อยู่ที่นี่

### `infrastructure/shopee/shopee-auth.gateway.ts`

ย้ายจาก `shopee-scraper.ts`:
- `launch()`, `login()`, `waitForVerification()`, `isActive()`, `close()`
- `extractCookies()`, `dismissLanguageDialog()`
- Browser lock cleanup logic
- Implements `AuthGateway`

### `infrastructure/shopee/shopee-api.gateway.ts`

ย้ายจาก `shopee-scraper.ts`:
- `getHeaders()`, `buildUrl()`, `apiPost()`
- `getOrderIndexes()`, `getOrderCards()`, `getTabMeta()`
- `fetchAll()` (เดิมคือ `scrapeAll()`)
- `parseOrderTime()`
- Implements `OrderGateway`
- รับ cookies จาก `ShopeeAuthGateway`

### `infrastructure/lazada/` (อนาคต)

สร้างเมื่อต้องการ — implement `AuthGateway` + `OrderGateway` เหมือนกัน

### `infrastructure/tiktok/` (อนาคต)

สร้างเมื่อต้องการ — implement `AuthGateway` + `OrderGateway` เหมือนกัน

### `infrastructure/cache/file-cache.ts`

ย้ายจาก `poll-scheduler.ts`:
- `loadCache()`, `saveCache()`
- Implements `CachePort<ScrapeResult>`
- รับ path ผ่าน constructor

### `infrastructure/scheduler/interval-scheduler.ts`

ย้ายจาก `poll-scheduler.ts`:
- `start(callback, intervalMs)`, `stop()`, `setInterval()`, `isRunning()`
- Pure interval management ไม่มี business logic

---

## Interface Adapter Layer (`routes/`)

เรียก use cases เท่านั้น — ไม่มี business logic

### `routes/auth.routes.ts`

```
GET /api/auth/status
  → checkAuthUseCase.execute()
  → return { loggedIn }
```

### `routes/order.routes.ts`

```
GET  /api/orders/summary
  → fetchOrdersUseCase.getCached()

POST /api/orders/refresh
  → fetchOrdersUseCase.execute()
```

### `routes/settings.routes.ts`

```
GET  /api/settings/polling     → managePollingUseCase.getStatus()
POST /api/settings/polling/start → managePollingUseCase.start()
POST /api/settings/polling/stop  → managePollingUseCase.stop()
PATCH /api/settings/interval    → managePollingUseCase.setInterval()
```

---

## Bootstrap (`index.ts`)

Wire everything together — Dependency Injection ด้วยมือ

```typescript
// 1. สร้าง infrastructure
const shopeeAuth = new ShopeeAuthGateway()
const shopeeApi = new ShopeeApiGateway(shopeeAuth)
const cache = new FileCache('./data/cache.json')
const scheduler = new IntervalScheduler()

// 2. สร้าง use cases
const checkAuth = new CheckAuthUseCase(shopeeAuth, env.SHOPEE_USERNAME, env.SHOPEE_PASSWORD)
const fetchOrders = new FetchOrdersUseCase(shopeeApi, cache)
const managePolling = new ManagePollingUseCase(fetchOrders, scheduler)

// 3. Mount routes
app.use('/api/auth', createAuthRoutes(checkAuth, managePolling))
app.use('/api/orders', createOrderRoutes(fetchOrders))
app.use('/api/settings', createSettingsRoutes(managePolling))
```

---

## Migration Map

| ก่อน | หลัง | บรรทัด |
|------|------|--------|
| `scraper/parser.ts` | `domain/entities/order.ts` | ~30 |
| `scraper/shopee-scraper.ts` auth | `infrastructure/shopee/shopee-auth.gateway.ts` | ~120 |
| `scraper/shopee-scraper.ts` API | `infrastructure/shopee/shopee-api.gateway.ts` | ~180 |
| `scheduler/poll-scheduler.ts` cache | `infrastructure/cache/file-cache.ts` | ~40 |
| `scheduler/poll-scheduler.ts` polling | `infrastructure/scheduler/interval-scheduler.ts` | ~30 |
| `scheduler/poll-scheduler.ts` orchestration | `usecases/fetch-orders.usecase.ts` | ~50 |
| `auth.routes.ts` login logic | `usecases/check-auth.usecase.ts` | ~40 |
| — (ใหม่) | `domain/entities/account.ts` | ~20 |
| — (ใหม่) | `domain/ports/*.ts` | ~30 |
| — (ใหม่) | `usecases/manage-polling.usecase.ts` | ~40 |

**รวม: ~580 บรรทัด → ~580 บรรทัด (ขนาดเท่ากัน แต่แยกไฟล์ชัดเจน)**

---

## Scope ครั้งนี้

- Refactor backend ตาม Clean Architecture ข้างบน
- Implement เฉพาะ **Shopee** gateway (1 account)
- สร้าง `Account` entity + `Platform` enum เตรียมไว้
- **ไม่** implement Lazada/TikTok (แค่เตรียม structure)
- **ไม่** เปลี่ยน API endpoints (frontend ไม่ต้องแก้)
- **ไม่** เปลี่ยน functionality — ทำงานเหมือนเดิมทุกอย่าง

## Verification

1. `npx tsc --noEmit` — ไม่มี error
2. `curl POST /api/orders/refresh` — ได้ข้อมูลเหมือนเดิม
3. `curl GET /api/auth/status` — auto-login ได้
4. Frontend ทำงานปกติ ไม่ต้องแก้อะไร
5. ไม่มีไฟล์เกิน 200 บรรทัด
