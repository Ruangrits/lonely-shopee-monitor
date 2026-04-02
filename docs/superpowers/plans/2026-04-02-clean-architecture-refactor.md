# Clean Architecture Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor backend จาก god class (`shopee-scraper.ts` 401 lines) เป็น Clean Architecture 4 layers รองรับ multi-platform ในอนาคต

**Architecture:** Domain layer (entities + ports) → Use Cases (orchestration) → Infrastructure (Shopee gateway, cache, scheduler) → Routes (HTTP adapters) wired ผ่าน manual DI ใน index.ts

**Tech Stack:** TypeScript, Express, Playwright, Node.js fetch

---

## File Structure

```
backend/src/
├── domain/
│   ├── entities.ts          ← OrderItem, Order, OrderSummary, ScrapeResult, Account, Platform
│   └── ports.ts             ← AuthGateway, OrderGateway, CachePort interfaces
├── usecases/
│   ├── check-auth.usecase.ts
│   ├── fetch-orders.usecase.ts
│   └── manage-polling.usecase.ts
├── infrastructure/
│   └── shopee/
│       ├── shopee-auth.gateway.ts    ← Playwright login (implements AuthGateway)
│       └── shopee-api.gateway.ts     ← Shopee API calls (implements OrderGateway)
│   ├── file-cache.ts                 ← JSON file cache (implements CachePort)
│   └── interval-scheduler.ts         ← setInterval wrapper
├── routes/
│   ├── auth.routes.ts
│   ├── order.routes.ts
│   └── settings.routes.ts
└── index.ts                          ← Bootstrap + DI
```

**ลบ:** `scraper/shopee-scraper.ts`, `scraper/parser.ts`, `scheduler/poll-scheduler.ts`

---

### Task 1: Domain Layer — entities + ports

**Files:**
- Create: `backend/src/domain/entities.ts`
- Create: `backend/src/domain/ports.ts`

- [ ] **Step 1: Create domain/entities.ts**

```typescript
// backend/src/domain/entities.ts

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

export enum Platform {
  Shopee = 'shopee',
  Lazada = 'lazada',
  TikTok = 'tiktok',
}

export interface Account {
  id: string
  platform: Platform
  name: string
  credentials: { username: string; password: string }
}

export function summaryChanged(a: ScrapeResult, b: ScrapeResult): boolean {
  const sa = a.summary
  const sb = b.summary
  return sa.toShip !== sb.toShip
    || sa.shipping !== sb.shipping
    || sa.unpaid !== sb.unpaid
    || sa.completed !== sb.completed
    || sa.cancelled !== sb.cancelled
    || sa.toShipUnprocessed !== sb.toShipUnprocessed
    || sa.toShipProcessed !== sb.toShipProcessed
    || a.toShipOrders.length !== b.toShipOrders.length
    || a.shippingOrders.length !== b.shippingOrders.length
}

export const EMPTY_RESULT: ScrapeResult = {
  summary: { unpaid: 0, toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0, shipping: 0, completed: 0, cancelled: 0 },
  toShipOrders: [],
  shippingOrders: [],
}
```

- [ ] **Step 2: Create domain/ports.ts**

```typescript
// backend/src/domain/ports.ts

import type { ScrapeResult } from './entities.js'

export interface AuthResult {
  success: boolean
  needsVerification: boolean
  error?: string
}

export interface AuthGateway {
  launch(): Promise<void>
  login(username: string, password: string): Promise<AuthResult>
  waitForVerification(): Promise<{ success: boolean; error?: string }>
  isActive(): boolean
  close(): Promise<void>
}

export interface OrderGateway {
  fetchAll(): Promise<ScrapeResult>
}

export interface CachePort<T> {
  load(): T | null
  save(data: T, scrapedAt: string): void
  getScrapedAt(): string
}

export interface Scheduler {
  start(callback: () => void | Promise<void>, intervalMs: number): void
  stop(): void
  setInterval(intervalMs: number): void
  isRunning(): boolean
  getIntervalMs(): number
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/domain/
git commit -m "refactor: add domain layer (entities + ports)"
```

---

### Task 2: Infrastructure — Shopee Auth Gateway

**Files:**
- Create: `backend/src/infrastructure/shopee/shopee-auth.gateway.ts`

- [ ] **Step 1: Create shopee-auth.gateway.ts**

ย้าย auth methods จาก `shopee-scraper.ts` lines 1-155 + 372-398

```typescript
// backend/src/infrastructure/shopee/shopee-auth.gateway.ts

import { chromium, type BrowserContext, type Page } from 'playwright'
import type { AuthGateway, AuthResult } from '../../domain/ports.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const SELLER_CENTRE_URL = 'https://seller.shopee.co.th'
const LOGIN_URL = `${SELLER_CENTRE_URL}/account/signin`
const ORDER_URL = `${SELLER_CENTRE_URL}/portal/sale`
const USER_DATA_DIR = path.resolve('./data/browser-profile')

export class ShopeeAuthGateway implements AuthGateway {
  private context: BrowserContext | null = null
  private page: Page | null = null
  private loggedIn = false
  private _cookies: string = ''

  get cookies(): string { return this._cookies }

  async launch() {
    await this.close()
    const headless = process.env.HEADLESS !== 'false'

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
          headless,
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          locale: 'th-TH',
        })
        this.page = this.context.pages()[0] || await this.context.newPage()
        console.log(`Browser launched (attempt ${attempt}, headless: ${headless})`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        console.error(`Launch attempt ${attempt} failed:`, msg)
        if (msg.includes('ProcessSingleton') || msg.includes('profile directory')) {
          try { execSync('pkill -f "Google Chrome for Testing.*browser-profile" 2>/dev/null || true') } catch { /* */ }
          const lockFile = path.join(USER_DATA_DIR, 'SingletonLock')
          if (fs.existsSync(lockFile)) fs.rmSync(lockFile)
          await new Promise((r) => setTimeout(r, 2000))
        } else {
          throw err
        }
      }
    }

    if (!this.context) throw new Error('Failed to launch browser after retries')
    await this.checkExistingSession()
  }

  private async checkExistingSession() {
    if (!this.page) return
    try {
      console.log('Checking existing session...')
      await this.page.goto(ORDER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await this.page.waitForTimeout(3000)
      const currentUrl = this.page.url()
      if (currentUrl.includes('/portal') || currentUrl.includes('is_from_login') || currentUrl === `${SELLER_CENTRE_URL}/`) {
        this.loggedIn = true
        await this.extractCookies()
        console.log('Existing session active — cookies extracted')
      } else {
        console.log('No existing session — login required')
      }
    } catch {
      console.log('Session check failed — login required')
    }
  }

  private async dismissLanguageDialog() {
    if (!this.page) return
    try {
      const thaiBtn = this.page.locator('text=ไทย').first()
      if (await thaiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await thaiBtn.click()
        await this.page.waitForTimeout(2000)
      }
    } catch { /* */ }
  }

  async login(username: string, password: string): Promise<AuthResult> {
    if (!this.page) throw new Error('Browser not launched')
    try {
      await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await this.page.waitForTimeout(3000)
      await this.dismissLanguageDialog()

      const usernameSelectors = [
        'input[type="text"]',
        'input[name="username"]',
        'input[name="loginKey"]',
        'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])',
      ]
      let usernameInput = null
      for (const sel of usernameSelectors) {
        if (await this.page.locator(sel).first().isVisible().catch(() => false)) {
          usernameInput = this.page.locator(sel).first()
          break
        }
      }
      if (!usernameInput) return { success: false, needsVerification: false, error: 'ไม่พบช่องกรอก username' }

      await usernameInput.fill(username)
      const passwordInput = this.page.locator('input[type="password"]').first()
      if (!await passwordInput.isVisible().catch(() => false)) return { success: false, needsVerification: false, error: 'ไม่พบช่องกรอก password' }
      await passwordInput.fill(password)

      for (const sel of ['button[type="submit"]', 'button:has-text("เข้าสู่ระบบ")', 'button:has-text("Log In")']) {
        if (await this.page.locator(sel).first().isVisible().catch(() => false)) {
          await this.page.locator(sel).first().click()
          break
        }
      }

      try {
        await this.page.waitForURL((url) => url.pathname.includes('/portal') || url.search.includes('is_from_login'), { timeout: 10000 })
        this.loggedIn = true
        await this.extractCookies()
        return { success: true, needsVerification: false }
      } catch {
        const pageContent = await this.page.content()
        if (pageContent.includes('verify') || pageContent.includes('ยืนยัน') || pageContent.includes('OTP')) {
          return { success: false, needsVerification: true }
        }
        return { success: false, needsVerification: false, error: 'Login ไม่สำเร็จ' }
      }
    } catch (err) {
      return { success: false, needsVerification: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async waitForVerification(): Promise<{ success: boolean; error?: string }> {
    if (!this.page) throw new Error('Browser not launched')
    try {
      await this.page.waitForURL((url) => url.pathname.includes('/portal') || url.search.includes('is_from_login'), { timeout: 120000 })
      this.loggedIn = true
      await this.extractCookies()
      return { success: true }
    } catch {
      return { success: false, error: 'หมดเวลารอการยืนยัน' }
    }
  }

  private async extractCookies() {
    if (!this.context) return
    const cookies = await this.context.cookies(SELLER_CENTRE_URL)
    this._cookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    console.log(`Extracted ${cookies.length} cookies`)
  }

  isActive(): boolean {
    if (this.loggedIn && this.context) {
      try {
        if (this.context.pages().length === 0) { this.reset(); return false }
        return true
      } catch { this.reset(); return false }
    }
    return false
  }

  private reset() {
    this.context = null
    this.page = null
    this.loggedIn = false
    this._cookies = ''
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => {})
      this.reset()
      console.log('Browser closed')
    }
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/infrastructure/shopee/shopee-auth.gateway.ts
git commit -m "refactor: extract ShopeeAuthGateway from scraper"
```

---

### Task 3: Infrastructure — Shopee API Gateway

**Files:**
- Create: `backend/src/infrastructure/shopee/shopee-api.gateway.ts`

- [ ] **Step 1: Create shopee-api.gateway.ts**

ย้าย API methods จาก `shopee-scraper.ts` lines 157-370

```typescript
// backend/src/infrastructure/shopee/shopee-api.gateway.ts

import type { OrderGateway } from '../../domain/ports.js'
import type { ScrapeResult, Order, OrderItem, OrderSummary } from '../../domain/entities.js'
import { EMPTY_RESULT } from '../../domain/entities.js'
import type { ShopeeAuthGateway } from './shopee-auth.gateway.js'

const SELLER_CENTRE_URL = 'https://seller.shopee.co.th'
const ORDER_URL = `${SELLER_CENTRE_URL}/portal/sale`
const SHOPEE_IMAGE_CDN = 'https://cf.shopee.co.th/file/'

export class ShopeeApiGateway implements OrderGateway {
  constructor(private auth: ShopeeAuthGateway) {}

  private getHeaders(): Record<string, string> {
    return {
      'Cookie': this.auth.cookies,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Referer': ORDER_URL,
      'X-Requested-With': 'XMLHttpRequest',
    }
  }

  private buildUrl(endpoint: string): string {
    const match = this.auth.cookies.match(/SPC_CDS=([^;]+)/)
    const spcCds = match ? match[1] : ''
    const sep = endpoint.includes('?') ? '&' : '?'
    return `${SELLER_CENTRE_URL}${endpoint}${spcCds ? `${sep}SPC_CDS=${spcCds}&SPC_CDS_VER=2` : ''}`
  }

  private async apiPost(endpoint: string, body: unknown): Promise<unknown> {
    const res = await fetch(this.buildUrl(endpoint), {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
    return res.json()
  }

  private async getOrderIndexes(tab: number, actionFilter = 0): Promise<Array<{ order_id: number; shop_id: number; region_id: string }>> {
    const data = await this.apiPost('/api/v3/order/search_order_list_index', {
      order_list_tab: tab,
      entity_type: 1,
      pagination: { from_page_number: 1, page_number: 1, page_size: 40 },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: actionFilter },
      sort: { sort_type: 3, ascending: false },
    }) as { code: number; data: { index_list: Array<{ order_id: number; shop_id: number; region_id: string }> } }

    return data.code === 0 ? data.data.index_list : []
  }

  private parseOrderTime(orderSn: string): string {
    const match = orderSn.match(/^(\d{2})(\d{2})(\d{2})/)
    if (!match) return ''
    const thaiYear = parseInt(match[1]) + 43
    const monthNames = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = parseInt(match[2])
    const day = parseInt(match[3])
    return `${day} ${monthNames[month] || match[2]} ${thaiYear}`
  }

  private async getOrderCards(tab: number, orderParams: Array<{ order_id: number; shop_id: number; region_id: string }>): Promise<Order[]> {
    if (orderParams.length === 0) return []

    const orders: Order[] = []
    const batchSize = 5

    for (let i = 0; i < orderParams.length; i += batchSize) {
      const batch = orderParams.slice(i, i + batchSize)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await this.apiPost('/api/v3/order/get_order_list_card_list', {
          order_list_tab: tab,
          need_count_down_desc: true,
          order_param_list: batch,
        }) as { code: number; data: { card_list: Array<Record<string, unknown>> } }

        if (data.code !== 0) continue

        for (const rawCard of data.data.card_list) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const card = (rawCard as any).order_card || (rawCard as any).package_level_order_card
          if (!card) continue

          const orderId: string = card.card_header?.order_sn || ''
          const buyerName: string = card.card_header?.buyer_info?.username || ''
          const cardStatus: string = card.status_info?.status || ''

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let itemInfoLists: any[] = []
          if (card.item_info_group?.item_info_list) {
            itemInfoLists = card.item_info_group.item_info_list
          } else if (card.package_list) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const pkg of card.package_list as any[]) {
              if (pkg.item_info_group?.item_info_list) {
                itemInfoLists.push(...pkg.item_info_group.item_info_list)
              }
            }
          }

          const items: OrderItem[] = []
          for (const group of itemInfoLists) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const item of (group.item_list || []) as any[]) {
              const variantMatch = item.description?.match(/ตัวเลือกสินค้า:\s*(.+?)(?:\s*$)/)
              items.push({
                productName: item.name || '',
                variant: variantMatch ? variantMatch[1].trim() : '',
                quantity: item.amount || 1,
                imageUrl: item.image ? `${SHOPEE_IMAGE_CDN}${item.image}` : '',
              })
            }
          }

          orders.push({
            orderId,
            buyerName,
            orderTime: this.parseOrderTime(orderId),
            items,
            status: cardStatus,
          })
        }
      } catch (err) {
        console.error(`  Batch failed:`, err instanceof Error ? err.message : err)
      }
    }

    return orders
  }

  private async getTabMeta(): Promise<Omit<OrderSummary, 'toShipUnprocessed' | 'toShipProcessed'>> {
    try {
      const data = await this.apiPost('/api/v3/order/get_order_list_meta_v2', {}) as {
        code: number
        data: {
          OrderListTabMeta: Array<{
            to_ship_tab_meta?: { l1_meta: number }
            shipping_tab_meta?: { l1_meta: number }
            completed_tab_meta?: { l1_meta: number }
            cancellation_tab_meta?: { l1_meta: number }
            unpaid_tab_meta?: { l1_meta: number }
          }>
        }
      }

      if (data.code === 0 && data.data.OrderListTabMeta?.[0]) {
        const meta = data.data.OrderListTabMeta[0]
        return {
          unpaid: meta.unpaid_tab_meta?.l1_meta || 0,
          toShip: meta.to_ship_tab_meta?.l1_meta || 0,
          shipping: meta.shipping_tab_meta?.l1_meta || 0,
          completed: meta.completed_tab_meta?.l1_meta || 0,
          cancelled: meta.cancellation_tab_meta?.l1_meta || 0,
        }
      }
    } catch (err) {
      console.log('Tab meta API failed:', err instanceof Error ? err.message : err)
    }
    return { unpaid: 0, toShip: 0, shipping: 0, completed: 0, cancelled: 0 }
  }

  async fetchAll(): Promise<ScrapeResult> {
    if (!this.auth.cookies) { console.log('No cookies'); return EMPTY_RESULT }

    console.log('Fetching orders via API...')

    const tabMeta = await this.getTabMeta()

    const [toShipIndexes, shippingIndexes] = await Promise.all([
      this.getOrderIndexes(300),
      this.getOrderIndexes(400),
    ])
    console.log(`Indexes: toShip=${toShipIndexes.length}, shipping=${shippingIndexes.length}`)

    const [toShipOrders, shippingOrders] = await Promise.all([
      this.getOrderCards(300, toShipIndexes),
      this.getOrderCards(400, shippingIndexes),
    ])

    for (const order of toShipOrders) {
      order.status = order.status === 'ที่ต้องจัดส่ง' ? 'ยังไม่ดำเนินการ' : 'ดำเนินการแล้ว'
    }

    const unprocessedCount = toShipOrders.filter((o) => o.status === 'ยังไม่ดำเนินการ').length
    const processedCount = toShipOrders.filter((o) => o.status === 'ดำเนินการแล้ว').length

    console.log(`Orders: toShip=${toShipOrders.length} (unprocessed=${unprocessedCount}, processed=${processedCount}), shipping=${shippingOrders.length}`)

    return {
      summary: {
        unpaid: tabMeta.unpaid,
        toShip: tabMeta.toShip || toShipIndexes.length,
        toShipUnprocessed: unprocessedCount,
        toShipProcessed: processedCount,
        shipping: tabMeta.shipping || shippingIndexes.length,
        completed: tabMeta.completed,
        cancelled: tabMeta.cancelled,
      },
      toShipOrders,
      shippingOrders,
    }
  }
}
```

- [ ] **Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/infrastructure/shopee/shopee-api.gateway.ts
git commit -m "refactor: extract ShopeeApiGateway from scraper"
```

---

### Task 4: Infrastructure — Cache + Scheduler

**Files:**
- Create: `backend/src/infrastructure/file-cache.ts`
- Create: `backend/src/infrastructure/interval-scheduler.ts`

- [ ] **Step 1: Create file-cache.ts**

```typescript
// backend/src/infrastructure/file-cache.ts

import type { CachePort } from '../domain/ports.js'
import fs from 'fs'
import path from 'path'

export class FileCache<T> implements CachePort<T> {
  private scrapedAt = ''

  constructor(private filePath: string) {}

  load(): T | null {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        this.scrapedAt = raw.scrapedAt || ''
        console.log(`Cache loaded (scraped at ${this.scrapedAt})`)
        return raw.result as T
      }
    } catch {
      console.log('No cache found, starting fresh')
    }
    return null
  }

  save(data: T, scrapedAt: string): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      this.scrapedAt = scrapedAt
      fs.writeFileSync(this.filePath, JSON.stringify({ result: data, scrapedAt }), 'utf-8')
    } catch (err) {
      console.error('Failed to save cache:', err)
    }
  }

  getScrapedAt(): string { return this.scrapedAt }
}
```

- [ ] **Step 2: Create interval-scheduler.ts**

```typescript
// backend/src/infrastructure/interval-scheduler.ts

import type { Scheduler } from '../domain/ports.js'

export class IntervalScheduler implements Scheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private intervalMs: number
  private callback: (() => void | Promise<void>) | null = null

  constructor(defaultIntervalMs = 300_000) {
    this.intervalMs = defaultIntervalMs
  }

  start(callback: () => void | Promise<void>, intervalMs?: number): void {
    if (this.intervalId) return
    this.callback = callback
    if (intervalMs) this.intervalMs = intervalMs
    console.log(`Polling started (every ${this.intervalMs / 1000}s)`)
    this.intervalId = setInterval(callback, this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Polling stopped')
    }
  }

  setInterval(intervalMs: number): void {
    this.intervalMs = intervalMs
    if (this.intervalId && this.callback) {
      this.stop()
      this.start(this.callback)
    }
  }

  isRunning(): boolean { return this.intervalId !== null }
  getIntervalMs(): number { return this.intervalMs }
}
```

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/infrastructure/file-cache.ts backend/src/infrastructure/interval-scheduler.ts
git commit -m "refactor: extract FileCache + IntervalScheduler"
```

---

### Task 5: Use Cases

**Files:**
- Create: `backend/src/usecases/check-auth.usecase.ts`
- Create: `backend/src/usecases/fetch-orders.usecase.ts`
- Create: `backend/src/usecases/manage-polling.usecase.ts`

- [ ] **Step 1: Create check-auth.usecase.ts**

```typescript
// backend/src/usecases/check-auth.usecase.ts

import type { AuthGateway } from '../domain/ports.js'

export class CheckAuthUseCase {
  constructor(
    private auth: AuthGateway,
    private username: string,
    private password: string,
  ) {}

  async execute(): Promise<{ loggedIn: boolean }> {
    if (!this.auth.isActive()) {
      await this.auth.launch()
    }

    if (!this.auth.isActive() && this.username && this.password) {
      console.log('Auto-login with credentials from .env...')
      const result = await this.auth.login(this.username, this.password)

      if (result.needsVerification) {
        console.log('Verification required — waiting in background...')
        this.auth.waitForVerification().then((vResult) => {
          if (vResult.success) console.log('Verification successful')
        })
      }
    }

    return { loggedIn: this.auth.isActive() }
  }
}
```

- [ ] **Step 2: Create fetch-orders.usecase.ts**

```typescript
// backend/src/usecases/fetch-orders.usecase.ts

import type { OrderGateway, CachePort } from '../domain/ports.js'
import type { ScrapeResult } from '../domain/entities.js'
import { EMPTY_RESULT, summaryChanged } from '../domain/entities.js'

export class FetchOrdersUseCase {
  private latestResult: ScrapeResult

  constructor(
    private gateway: OrderGateway,
    private cache: CachePort<ScrapeResult>,
  ) {
    this.latestResult = cache.load() || EMPTY_RESULT
  }

  async execute(): Promise<ScrapeResult> {
    try {
      const newResult = await this.gateway.fetchAll()
      const now = new Date().toISOString()

      if (summaryChanged(this.latestResult, newResult)) {
        console.log('Data changed — updating cache')
        this.latestResult = newResult
        this.cache.save(newResult, now)
      } else {
        console.log('Data unchanged — keeping cache')
      }

      return this.latestResult
    } catch (err) {
      console.error('Fetch error:', err)
      return this.latestResult
    }
  }

  getCached(): ScrapeResult & { scrapedAt: string } {
    return { ...this.latestResult, scrapedAt: this.cache.getScrapedAt() }
  }
}
```

- [ ] **Step 3: Create manage-polling.usecase.ts**

```typescript
// backend/src/usecases/manage-polling.usecase.ts

import type { Scheduler } from '../domain/ports.js'
import type { FetchOrdersUseCase } from './fetch-orders.usecase.js'

export class ManagePollingUseCase {
  constructor(
    private fetchOrders: FetchOrdersUseCase,
    private scheduler: Scheduler,
  ) {}

  start(): void {
    this.scheduler.start(() => this.fetchOrders.execute(), this.scheduler.getIntervalMs())
  }

  stop(): void {
    this.scheduler.stop()
  }

  setInterval(seconds: number): void {
    this.scheduler.setInterval(seconds * 1000)
  }

  getStatus(): { active: boolean; interval: number } {
    return {
      active: this.scheduler.isRunning(),
      interval: this.scheduler.getIntervalMs() / 1000,
    }
  }
}
```

- [ ] **Step 4: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/usecases/
git commit -m "refactor: add use cases (check-auth, fetch-orders, manage-polling)"
```

---

### Task 6: Routes — Rewire to use cases

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/routes/order.routes.ts`
- Modify: `backend/src/routes/settings.routes.ts`

- [ ] **Step 1: Rewrite auth.routes.ts**

```typescript
// backend/src/routes/auth.routes.ts

import { Router } from 'express'
import type { CheckAuthUseCase } from '../usecases/check-auth.usecase.js'
import type { ManagePollingUseCase } from '../usecases/manage-polling.usecase.js'

export function createAuthRoutes(checkAuth: CheckAuthUseCase, polling: ManagePollingUseCase) {
  const router = Router()

  router.get('/status', async (_req, res) => {
    try {
      const { loggedIn } = await checkAuth.execute()
      if (loggedIn) polling.start()
      res.json({ loggedIn })
    } catch (err) {
      console.error('Auth status error:', err)
      res.json({ loggedIn: false })
    }
  })

  return router
}
```

- [ ] **Step 2: Rewrite order.routes.ts**

```typescript
// backend/src/routes/order.routes.ts

import { Router } from 'express'
import type { FetchOrdersUseCase } from '../usecases/fetch-orders.usecase.js'

export function createOrderRoutes(fetchOrders: FetchOrdersUseCase) {
  const router = Router()

  router.get('/summary', (_req, res) => {
    res.json(fetchOrders.getCached())
  })

  router.post('/refresh', async (_req, res) => {
    try {
      const result = await fetchOrders.execute()
      res.json({ ...result, scrapedAt: new Date().toISOString() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
```

- [ ] **Step 3: Rewrite settings.routes.ts**

```typescript
// backend/src/routes/settings.routes.ts

import { Router } from 'express'
import type { ManagePollingUseCase } from '../usecases/manage-polling.usecase.js'

export function createSettingsRoutes(polling: ManagePollingUseCase) {
  const router = Router()

  router.patch('/interval', (req, res) => {
    const { seconds } = req.body
    if (!seconds || typeof seconds !== 'number' || seconds < 10) {
      res.status(400).json({ error: 'Interval must be at least 10 seconds' })
      return
    }
    polling.setInterval(seconds)
    res.json({ interval: seconds })
  })

  router.get('/polling', (_req, res) => {
    res.json(polling.getStatus())
  })

  router.post('/polling/start', (_req, res) => {
    polling.start()
    res.json({ active: true })
  })

  router.post('/polling/stop', (_req, res) => {
    polling.stop()
    res.json({ active: false })
  })

  return router
}
```

- [ ] **Step 4: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/
git commit -m "refactor: rewire routes to use cases (factory functions)"
```

---

### Task 7: Bootstrap — index.ts + Cleanup

**Files:**
- Modify: `backend/src/index.ts`
- Delete: `backend/src/scraper/shopee-scraper.ts`
- Delete: `backend/src/scraper/parser.ts`
- Delete: `backend/src/scheduler/poll-scheduler.ts`

- [ ] **Step 1: Rewrite index.ts**

```typescript
// backend/src/index.ts

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { ShopeeAuthGateway } from './infrastructure/shopee/shopee-auth.gateway.js'
import { ShopeeApiGateway } from './infrastructure/shopee/shopee-api.gateway.js'
import { FileCache } from './infrastructure/file-cache.js'
import { IntervalScheduler } from './infrastructure/interval-scheduler.js'

import { CheckAuthUseCase } from './usecases/check-auth.usecase.js'
import { FetchOrdersUseCase } from './usecases/fetch-orders.usecase.js'
import { ManagePollingUseCase } from './usecases/manage-polling.usecase.js'

import { createAuthRoutes } from './routes/auth.routes.js'
import { createOrderRoutes } from './routes/order.routes.js'
import { createSettingsRoutes } from './routes/settings.routes.js'

import type { ScrapeResult } from './domain/entities.js'

dotenv.config()

// --- Infrastructure ---
const shopeeAuth = new ShopeeAuthGateway()
const shopeeApi = new ShopeeApiGateway(shopeeAuth)
const cache = new FileCache<ScrapeResult>('./data/cache.json')
const scheduler = new IntervalScheduler(
  parseInt(process.env.POLLING_INTERVAL || '300') * 1000
)

// --- Use Cases ---
const checkAuth = new CheckAuthUseCase(
  shopeeAuth,
  process.env.SHOPEE_USERNAME || '',
  process.env.SHOPEE_PASSWORD || '',
)
const fetchOrders = new FetchOrdersUseCase(shopeeApi, cache)
const managePolling = new ManagePollingUseCase(fetchOrders, scheduler)

// --- App ---
const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', createAuthRoutes(checkAuth, managePolling))
app.use('/api/orders', createOrderRoutes(fetchOrders))
app.use('/api/settings', createSettingsRoutes(managePolling))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, closing browser...`)
    await shopeeAuth.close()
    process.exit(0)
  })
}
```

- [ ] **Step 2: Delete old files**

```bash
rm backend/src/scraper/shopee-scraper.ts
rm backend/src/scraper/parser.ts
rmdir backend/src/scraper
rm backend/src/scheduler/poll-scheduler.ts
rmdir backend/src/scheduler
```

- [ ] **Step 3: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Build frontend**

Run: `cd ../frontend && npm run build`
Expected: Build succeeds (no changes needed)

- [ ] **Step 5: Test API**

```bash
# Kill stale browser
pkill -f "Google Chrome for Testing.*browser-profile" 2>/dev/null
rm -f data/browser-profile/SingletonLock data/cache.json

# Start backend
npm run dev &
sleep 15

# Test auth
curl -s http://localhost:3001/api/auth/status
# Expected: {"loggedIn":true}

# Test refresh
curl -s -X POST http://localhost:3001/api/orders/refresh | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'toShip={len(d.get(\"toShipOrders\",[]))}, shipping={len(d.get(\"shippingOrders\",[]))}')"
# Expected: toShip=N, shipping=N

# Test settings
curl -s http://localhost:3001/api/settings/polling
# Expected: {"active":true,"interval":300}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: complete Clean Architecture migration — domain, usecases, infrastructure, routes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Domain Layer (entities + ports) | 2 new |
| 2 | ShopeeAuthGateway | 1 new |
| 3 | ShopeeApiGateway | 1 new |
| 4 | FileCache + IntervalScheduler | 2 new |
| 5 | Use Cases (3) | 3 new |
| 6 | Rewire Routes | 3 modified |
| 7 | Bootstrap + Cleanup | 1 modified, 3 deleted |

**Total: 12 new files, 4 modified, 3 deleted**
**API endpoints unchanged — frontend works without changes**
