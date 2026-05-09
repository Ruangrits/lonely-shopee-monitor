# Order Processing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a root `/` page where staff process Shopee orders by marking them "มีของ"/"ไม่มีของ", upload evidence photos, with state persisted in backend JSON file and auto-sync from Shopee API.

**Architecture:** Backend adds `OrderStateStore` (JSON file at `data/order-states.json`), new REST routes for order state CRUD and multipart file upload (saved to `/Volumes/public/lonely-monitor/image-verify/DD-MM-YYYY/{orderId}/`). Frontend adds a new `order-processing` module with 3-tab layout, pending/processed cards, and a processing dialog. Root page syncs on load + every 5 min + manual button.

**Tech Stack:** Node.js/TypeScript, Express, multer (file upload), Svelte 5 runes, Tailwind CSS

---

## File Map

**Backend — New:**
- `backend/src/infrastructure/order-state.store.ts` — JSON read/write for order states
- `backend/src/routes/order-state.routes.ts` — state CRUD + multer upload routes

**Backend — Modified:**
- `backend/package.json` — add multer + @types/multer
- `backend/src/index.ts` — instantiate OrderStateStore, mount new routes

**Frontend — New:**
- `frontend/src/lib/modules/order-processing/data.ts`
- `frontend/src/lib/modules/order-processing/order-processing.service.ts`
- `frontend/src/lib/modules/order-processing/components/ProcessingTabFilter.svelte`
- `frontend/src/lib/modules/order-processing/components/PendingOrderCard.svelte`
- `frontend/src/lib/modules/order-processing/components/ProcessedOrderCard.svelte`
- `frontend/src/lib/modules/order-processing/components/ProcessOrderDialog.svelte`
- `frontend/src/lib/modules/order-processing/OrderProcessing.svelte`

**Frontend — Modified:**
- `frontend/src/routes/+page.svelte` — mount OrderProcessing component

---

### Task 1: Backend — Install multer

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install multer and types**

```bash
cd backend && npm install multer && npm install --save-dev @types/multer
```

Expected: `node_modules/multer` exists, package.json updated

- [ ] **Step 2: Verify**

```bash
cd backend && node -e "require('multer'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json && git commit -m "chore: add multer for multipart file upload"
```

---

### Task 2: Backend — OrderStateStore

**Files:**
- Create: `backend/src/infrastructure/order-state.store.ts`

- [ ] **Step 1: Create the store**

Create `backend/src/infrastructure/order-state.store.ts`:

```typescript
import fs from 'fs'
import path from 'path'

export interface LocalOrderState {
  orderId: string
  state: 'with_stock' | 'no_stock'
  reason?: 'out_of_stock' | 'different_variant'
  imageUrls: string[]
  processedAt: string
}

export class OrderStateStore {
  private states: Map<string, LocalOrderState> = new Map()

  constructor(private filePath: string) {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as LocalOrderState[]
        for (const s of data) this.states.set(s.orderId, s)
      }
    } catch { /* start empty */ }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify([...this.states.values()], null, 2))
  }

  getAll(): LocalOrderState[] {
    return [...this.states.values()]
  }

  set(state: LocalOrderState): void {
    this.states.set(state.orderId, state)
    this.persist()
  }
}
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: no errors (empty output)

- [ ] **Step 3: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add backend/src/infrastructure/order-state.store.ts && git commit -m "feat: add OrderStateStore for persistent order processing state"
```

---

### Task 3: Backend — Order state routes + upload

**Files:**
- Create: `backend/src/routes/order-state.routes.ts`

- [ ] **Step 1: Create routes file**

Create `backend/src/routes/order-state.routes.ts`:

```typescript
import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import type { OrderStateStore, LocalOrderState } from '../infrastructure/order-state.store.js'

const IMAGE_BASE = '/Volumes/public/lonely-monitor/image-verify'

function getUploadDir(orderId: string): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return path.join(IMAGE_BASE, `${dd}-${mm}-${yyyy}`, orderId)
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = getUploadDir(req.params.orderId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}${ext}`)
  },
})

const upload = multer({ storage })

export function createOrderStateRoutes(store: OrderStateStore) {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(store.getAll())
  })

  router.post('/:orderId', (req, res) => {
    const { orderId } = req.params
    const { state, reason, imageUrls } = req.body as {
      state: 'with_stock' | 'no_stock'
      reason?: 'out_of_stock' | 'different_variant'
      imageUrls?: string[]
    }

    const localState: LocalOrderState = {
      orderId,
      state,
      reason,
      imageUrls: imageUrls ?? [],
      processedAt: new Date().toISOString(),
    }

    store.set(localState)
    res.json(localState)
  })

  return router
}

export function createUploadRoutes() {
  const router = Router()

  router.post('/:orderId', upload.array('images'), (req, res) => {
    const files = req.files as Express.Multer.File[]
    const imageUrls = files.map(f => f.path)
    res.json({ imageUrls })
  })

  return router
}
```

- [ ] **Step 2: Verify build**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add backend/src/routes/order-state.routes.ts && git commit -m "feat: add order state CRUD and upload routes"
```

---

### Task 4: Backend — Wire into index.ts

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Add imports to index.ts**

After the existing infrastructure imports, add:

```typescript
import { OrderStateStore } from './infrastructure/order-state.store.js'
import { createOrderStateRoutes, createUploadRoutes } from './routes/order-state.routes.js'
```

- [ ] **Step 2: Instantiate OrderStateStore**

After the `const dataDir = ...` line, add:

```typescript
const orderStateStore = new OrderStateStore(path.join(dataDir, 'order-states.json'))
```

- [ ] **Step 3: Mount new routes**

After `app.use('/api/orders', createOrderRoutes(fetchOrdersList))`, add:

```typescript
app.use('/api/order-states', createOrderStateRoutes(orderStateStore))
app.use('/api/uploads', createUploadRoutes())
```

- [ ] **Step 4: Verify build**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add backend/src/index.ts && git commit -m "feat: wire OrderStateStore and new routes into server"
```

---

### Task 5: Frontend — Types + service

**Files:**
- Create: `frontend/src/lib/modules/order-processing/data.ts`
- Create: `frontend/src/lib/modules/order-processing/order-processing.service.ts`

- [ ] **Step 1: Create data.ts**

Create `frontend/src/lib/modules/order-processing/data.ts`:

```typescript
export type { Order, OrderItem } from '$lib/modules/dashboard/data'

export type LocalOrderStateValue = 'with_stock' | 'no_stock'
export type NoStockReason = 'out_of_stock' | 'different_variant'

export interface LocalOrderState {
  orderId: string
  state: LocalOrderStateValue
  reason?: NoStockReason
  imageUrls: string[]
  processedAt: string
}

export interface ProcessingOrder {
  orderId: string
  buyerName: string
  orderTime: string
  items: Array<{ productName: string; variant: string; quantity: number; imageUrl: string }>
  status: string
  accountName?: string
  platform?: string
}

export interface ProcessedOrderEntry extends ProcessingOrder {
  localState: LocalOrderState
}
```

- [ ] **Step 2: Create order-processing.service.ts**

Create `frontend/src/lib/modules/order-processing/order-processing.service.ts`:

```typescript
import { Blizzard } from 'th-lonely-universe-web-lib/blizzard'
import { Either } from 'th-lonely-universe-web-lib/fp'
import type { Future } from 'th-lonely-universe-web-lib/async'
import type { LocalOrderState } from './data'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001')

const client = Blizzard(API_BASE, { 'Content-Type': 'application/json' })

export const orderProcessingService = {
  getOrderStates(): Future<unknown, LocalOrderState[]> {
    return client.get('/api/order-states').fetch().readToJson()
      .deserialize<unknown, LocalOrderState[]>((j) => Either.Right(j as LocalOrderState[]))
      .toFuture()
  },

  setOrderState(
    orderId: string,
    payload: { state: LocalOrderState['state']; reason?: LocalOrderState['reason']; imageUrls: string[] }
  ): Future<unknown, LocalOrderState> {
    return client.post(`/api/order-states/${orderId}`)
      .withBody(JSON.stringify(payload))
      .fetch().readToJson()
      .deserialize<unknown, LocalOrderState>((j) => Either.Right(j as LocalOrderState))
      .toFuture()
  },

  async uploadImages(orderId: string, files: File[]): Promise<{ imageUrls: string[] }> {
    const formData = new FormData()
    for (const file of files) formData.append('images', file)
    const res = await fetch(`${API_BASE}/api/uploads/${orderId}`, {
      method: 'POST',
      body: formData,
    })
    return res.json() as Promise<{ imageUrls: string[] }>
  },
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 4: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/lib/modules/order-processing/ && git commit -m "feat: add order processing types and service"
```

---

### Task 6: Frontend — ProcessingTabFilter

**Files:**
- Create: `frontend/src/lib/modules/order-processing/components/ProcessingTabFilter.svelte`

- [ ] **Step 1: Create component**

Create `frontend/src/lib/modules/order-processing/components/ProcessingTabFilter.svelte`:

```svelte
<script lang="ts">
  let {
    pendingCount = 0,
    withStockCount = 0,
    noStockCount = 0,
    activeTab = 'pending',
    onTabChange
  }: {
    pendingCount?: number
    withStockCount?: number
    noStockCount?: number
    activeTab?: string
    onTabChange?: (tab: string) => void
  } = $props()

  const tabs = $derived([
    { id: 'pending', label: 'ยังไม่ดำเนินการ', count: pendingCount },
    { id: 'with_stock', label: 'ดำเนินการแล้ว\n(มีสินค้า)', count: withStockCount },
    { id: 'no_stock', label: 'ดำเนินการแล้ว\n(ไม่มีสินค้า)', count: noStockCount },
  ])
</script>

<div class="flex bg-white rounded-xl border border-grey-100 overflow-hidden shadow-sm">
  {#each tabs as tab}
    <button
      class="flex-1 text-center py-3 px-2 sm:py-4 sm:px-3 cursor-pointer border-b-3 transition-all
        {activeTab === tab.id
          ? 'bg-primary-50 border-b-primary-400'
          : 'border-b-transparent hover:bg-grey-50'}"
      onclick={() => onTabChange?.(tab.id)}
    >
      <div class="text-xs font-medium whitespace-pre-line leading-tight {activeTab === tab.id ? 'text-primary-400' : 'text-grey-300'}">
        {tab.label}
      </div>
      <div class="text-2xl sm:text-3xl font-bold mt-1 {activeTab === tab.id ? 'text-primary-500' : 'text-grey-400'}">
        {tab.count}
      </div>
    </button>
  {/each}
</div>
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 3: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/lib/modules/order-processing/components/ProcessingTabFilter.svelte && git commit -m "feat: add ProcessingTabFilter with 3 tabs"
```

---

### Task 7: Frontend — PendingOrderCard + ProcessedOrderCard

**Files:**
- Create: `frontend/src/lib/modules/order-processing/components/PendingOrderCard.svelte`
- Create: `frontend/src/lib/modules/order-processing/components/ProcessedOrderCard.svelte`

- [ ] **Step 1: Create PendingOrderCard**

Create `frontend/src/lib/modules/order-processing/components/PendingOrderCard.svelte`:

```svelte
<script lang="ts">
  import type { ProcessingOrder } from '../data'

  let { order, onClick }: { order: ProcessingOrder; onClick: () => void } = $props()

  const totalQty = $derived(order.items.reduce((sum, item) => sum + item.quantity, 0))
</script>

<button
  class="w-full text-left bg-white border border-grey-100 rounded-xl p-3 sm:p-4 shadow-sm hover:border-primary-200 hover:shadow-md transition-all"
  onclick={onClick}
>
  <div class="flex justify-between items-start gap-2 mb-3">
    <div class="flex items-center gap-1.5 flex-wrap min-w-0">
      <span class="text-primary-400 text-xs font-semibold">#{order.orderId}</span>
      <span class="text-grey-200 text-xs">•</span>
      <span class="text-grey-300 text-xs">👤 {order.buyerName || '-'}</span>
      {#if order.accountName}
        <span class="text-grey-200 text-xs">•</span>
        <span class="text-grey-400 text-2xs font-semibold">{order.accountName}</span>
      {/if}
    </div>
    <span class="text-2xs px-2 py-1 rounded-full font-semibold border shrink-0 bg-primary-50 text-primary-500 border-primary-100">
      รอดำเนินการ
    </span>
  </div>

  <div class="flex items-center gap-3 py-2 border-t border-grey-100">
    {#if order.items[0]?.imageUrl}
      <img src={order.items[0].imageUrl} alt="" class="w-12 h-12 object-cover rounded-lg border border-primary-100 shrink-0" />
    {:else}
      <div class="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center shrink-0 text-xl">📷</div>
    {/if}
    <div class="flex-1 min-w-0">
      <div class="text-grey-400 text-sm font-medium leading-snug truncate">{order.items[0]?.productName || '-'}</div>
      {#if order.items.length > 1}
        <div class="text-grey-300 text-xs mt-0.5">+{order.items.length - 1} รายการ</div>
      {/if}
    </div>
    <div class="text-primary-400 text-2xl font-extrabold shrink-0">
      {totalQty}<span class="text-grey-300 text-2xs ml-0.5">ชิ้น</span>
    </div>
  </div>

  <div class="flex justify-between items-center pt-2 border-t border-grey-100 mt-1">
    <span class="text-grey-200 text-xs">{order.orderTime || '-'}</span>
    <span class="text-primary-400 text-xs font-semibold">กดเพื่อดำเนินการ →</span>
  </div>
</button>
```

- [ ] **Step 2: Create ProcessedOrderCard**

Create `frontend/src/lib/modules/order-processing/components/ProcessedOrderCard.svelte`:

```svelte
<script lang="ts">
  import type { ProcessedOrderEntry } from '../data'

  let { order }: { order: ProcessedOrderEntry } = $props()

  const totalQty = $derived(order.items.reduce((sum, item) => sum + item.quantity, 0))
  const isWithStock = $derived(order.localState.state === 'with_stock')
  const reasonLabel = $derived(
    order.localState.reason === 'out_of_stock' ? 'สินค้าหมด' :
    order.localState.reason === 'different_variant' ? 'มีสินค้า (สี/ไซซ์/ขนาด) อื่น' : ''
  )
</script>

<div class="bg-white border border-grey-100 rounded-xl p-3 sm:p-4 shadow-sm opacity-80">
  <div class="flex justify-between items-start gap-2 mb-3">
    <div class="flex items-center gap-1.5 flex-wrap min-w-0">
      <span class="text-primary-400 text-xs font-semibold">#{order.orderId}</span>
      <span class="text-grey-200 text-xs">•</span>
      <span class="text-grey-300 text-xs">👤 {order.buyerName || '-'}</span>
    </div>
    <span class="text-2xs px-2 py-1 rounded-full font-semibold border shrink-0
      {isWithStock
        ? 'bg-success-50 text-success-200 border-success-100'
        : 'bg-danger-50 text-danger-200 border-danger-100'}">
      {isWithStock ? 'มีสินค้า' : 'ไม่มีสินค้า'}
    </span>
  </div>

  <div class="flex items-center gap-3 py-2 border-t border-grey-100">
    {#if order.items[0]?.imageUrl}
      <img src={order.items[0].imageUrl} alt="" class="w-12 h-12 object-cover rounded-lg border border-grey-100 shrink-0" />
    {:else}
      <div class="w-12 h-12 bg-grey-50 rounded-lg flex items-center justify-center shrink-0 text-xl">📷</div>
    {/if}
    <div class="flex-1 min-w-0">
      <div class="text-grey-400 text-sm font-medium leading-snug truncate">{order.items[0]?.productName || '-'}</div>
      {#if !isWithStock && reasonLabel}
        <div class="text-danger-200 text-xs mt-0.5">สาเหตุ: {reasonLabel}</div>
      {/if}
    </div>
    <div class="text-grey-400 text-2xl font-extrabold shrink-0">
      {totalQty}<span class="text-grey-300 text-2xs ml-0.5">ชิ้น</span>
    </div>
  </div>

  {#if order.localState.imageUrls.length > 0}
    <div class="pt-2 border-t border-grey-100 mt-1">
      <span class="text-grey-200 text-xs">รูปแนบ: {order.localState.imageUrls.length} ใบ</span>
    </div>
  {/if}
</div>
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 4: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/lib/modules/order-processing/components/ && git commit -m "feat: add PendingOrderCard and ProcessedOrderCard"
```

---

### Task 8: Frontend — ProcessOrderDialog

**Files:**
- Create: `frontend/src/lib/modules/order-processing/components/ProcessOrderDialog.svelte`

- [ ] **Step 1: Create dialog**

Create `frontend/src/lib/modules/order-processing/components/ProcessOrderDialog.svelte`:

```svelte
<script lang="ts">
  import type { ProcessingOrder, LocalOrderState, NoStockReason } from '../data'
  import { orderProcessingService } from '../order-processing.service'

  let { order, onClose, onProcessed }: {
    order: ProcessingOrder
    onClose: () => void
    onProcessed: (state: LocalOrderState) => void
  } = $props()

  type Step = 'choose' | 'with_stock' | 'no_stock'
  let step = $state<Step>('choose')
  let noStockReason = $state<NoStockReason | ''>('')
  let selectedFiles = $state<File[]>([])
  let previews = $state<string[]>([])
  let submitting = $state(false)
  let errorMsg = $state('')

  const uploadRequired = $derived(
    step === 'with_stock' || (step === 'no_stock' && noStockReason === 'different_variant')
  )

  const canSubmit = $derived(
    step !== 'choose' &&
    (step === 'no_stock' ? noStockReason !== '' : true) &&
    (!uploadRequired || selectedFiles.length > 0) &&
    !submitting
  )

  function addFiles(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files) return
    const newFiles = Array.from(input.files)
    selectedFiles = [...selectedFiles, ...newFiles]
    previews = [...previews, ...newFiles.map(f => URL.createObjectURL(f))]
    input.value = ''
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index])
    selectedFiles = selectedFiles.filter((_, i) => i !== index)
    previews = previews.filter((_, i) => i !== index)
  }

  async function submit() {
    submitting = true
    errorMsg = ''
    try {
      let imageUrls: string[] = []
      if (selectedFiles.length > 0) {
        const uploaded = await orderProcessingService.uploadImages(order.orderId, selectedFiles)
        imageUrls = uploaded.imageUrls
      }

      const payload = {
        state: (step === 'with_stock' ? 'with_stock' : 'no_stock') as LocalOrderState['state'],
        reason: step === 'no_stock' ? (noStockReason as NoStockReason) : undefined,
        imageUrls,
      }

      const result = await orderProcessingService.setOrderState(order.orderId, payload).promise
      if (result.isRight) {
        onProcessed(result.getRight())
      } else {
        errorMsg = 'บันทึกไม่สำเร็จ กรุณาลองใหม่'
      }
    } catch {
      errorMsg = 'เกิดข้อผิดพลาด กรุณาลองใหม่'
    }
    submitting = false
  }
</script>

<div
  class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
  onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
  role="dialog"
  aria-modal="true"
>
  <div class="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">

    <!-- Handle (mobile) -->
    <div class="flex justify-center pt-3 pb-1 sm:hidden">
      <div class="w-10 h-1 bg-grey-200 rounded-full"></div>
    </div>

    <!-- Header -->
    <div class="flex justify-between items-center px-4 py-3 border-b border-grey-100">
      <h2 class="text-grey-400 font-bold text-base">รายละเอียดคำสั่งซื้อ</h2>
      <button class="text-grey-300 hover:text-grey-400 p-1 text-lg" onclick={onClose}>✕</button>
    </div>

    <!-- Order info -->
    <div class="px-4 py-3 border-b border-grey-100">
      <div class="text-xs text-grey-300 mb-2">#{order.orderId} · {order.buyerName || '-'}</div>
      {#each order.items as item}
        <div class="flex gap-3 py-2 border-t border-grey-100 first:border-t-0">
          {#if item.imageUrl}
            <img src={item.imageUrl} alt={item.productName} class="w-16 h-16 object-cover rounded-lg border border-primary-100 shrink-0" />
          {:else}
            <div class="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center text-2xl shrink-0">📷</div>
          {/if}
          <div class="flex-1 min-w-0">
            <div class="text-grey-400 text-sm font-medium leading-snug">{item.productName}</div>
            {#if item.variant}
              <div class="text-grey-300 text-xs mt-0.5">ตัวเลือก: <span class="text-primary-300 font-medium">{item.variant}</span></div>
            {/if}
            <div class="text-primary-400 text-sm font-bold mt-1">x{item.quantity}</div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Action -->
    <div class="px-4 py-4">

      {#if step === 'choose'}
        <p class="text-grey-300 text-sm text-center mb-4">เลือกสถานะสินค้า</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            class="py-3 rounded-xl border-2 border-success-100 bg-success-50 text-success-200 font-semibold text-sm hover:bg-success-100 transition-colors"
            onclick={() => step = 'with_stock'}
          >มีของ</button>
          <button
            class="py-3 rounded-xl border-2 border-danger-100 bg-danger-50 text-danger-200 font-semibold text-sm hover:bg-danger-100 transition-colors"
            onclick={() => step = 'no_stock'}
          >ไม่มีของ</button>
        </div>

      {:else if step === 'with_stock'}
        <div class="flex items-center gap-2 mb-4">
          <button class="text-grey-300 text-sm hover:text-grey-400" onclick={() => { step = 'choose'; selectedFiles = []; previews = [] }}>← กลับ</button>
          <span class="text-success-200 font-semibold text-sm">มีของ — แนบรูปสินค้า</span>
        </div>
        <label class="block border-2 border-dashed border-primary-200 rounded-xl p-4 text-center cursor-pointer hover:bg-primary-50 transition-colors">
          <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} />
          <div class="text-grey-300 text-sm">กดเพื่อเลือกรูป (ได้หลายใบ)</div>
          <div class="text-primary-400 text-xs mt-1">* จำเป็นต้องแนบอย่างน้อย 1 รูป</div>
        </label>

      {:else if step === 'no_stock'}
        <div class="flex items-center gap-2 mb-4">
          <button class="text-grey-300 text-sm hover:text-grey-400" onclick={() => { step = 'choose'; noStockReason = ''; selectedFiles = []; previews = [] }}>← กลับ</button>
          <span class="text-danger-200 font-semibold text-sm">ไม่มีของ — ระบุสาเหตุ</span>
        </div>
        <select
          class="w-full border border-grey-200 rounded-lg px-3 py-2 text-sm text-grey-400 mb-4 focus:outline-none focus:border-primary-300"
          bind:value={noStockReason}
        >
          <option value="">เลือกสาเหตุ</option>
          <option value="out_of_stock">สินค้าหมด</option>
          <option value="different_variant">มีสินค้า (สี/ไซซ์/ขนาด) อื่น แต่แบบเดียวกัน</option>
        </select>

        <label class="block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
          {noStockReason === 'different_variant' ? 'border-danger-200 hover:bg-danger-50' : 'border-grey-200 hover:bg-grey-50'}">
          <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} />
          <div class="text-grey-300 text-sm">กดเพื่อแนบรูป</div>
          <div class="text-xs mt-1 {noStockReason === 'different_variant' ? 'text-danger-200' : 'text-grey-200'}">
            {noStockReason === 'different_variant' ? '* จำเป็นต้องแนบรูป' : 'ไม่บังคับ'}
          </div>
        </label>
      {/if}

      <!-- Previews -->
      {#if previews.length > 0}
        <div class="mt-3 grid grid-cols-3 gap-2">
          {#each previews as preview, i}
            <div class="relative">
              <img src={preview} alt="" class="w-full aspect-square object-cover rounded-lg border border-grey-100" />
              <button
                class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
                onclick={() => removeFile(i)}
              >✕</button>
            </div>
          {/each}
          {#if step !== 'choose'}
            <label class="aspect-square border-2 border-dashed border-grey-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-grey-50">
              <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} />
              <span class="text-grey-300 text-2xl">+</span>
            </label>
          {/if}
        </div>
      {/if}

      <!-- Error -->
      {#if errorMsg}
        <div class="mt-3 p-3 bg-danger-50 text-danger-200 text-sm rounded-lg">{errorMsg}</div>
      {/if}

      <!-- Submit -->
      {#if step !== 'choose'}
        <button
          class="mt-4 w-full py-3 rounded-xl font-semibold text-sm transition-colors
            {canSubmit ? 'bg-primary-400 hover:bg-primary-500 text-white' : 'bg-grey-100 text-grey-300 cursor-not-allowed'}"
          disabled={!canSubmit}
          onclick={submit}
        >
          {submitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
        </button>
      {/if}
    </div>

  </div>
</div>
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 3: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/lib/modules/order-processing/components/ProcessOrderDialog.svelte && git commit -m "feat: add ProcessOrderDialog with stock selection and image upload"
```

---

### Task 9: Frontend — OrderProcessing root component

**Files:**
- Create: `frontend/src/lib/modules/order-processing/OrderProcessing.svelte`

- [ ] **Step 1: Create root component**

Create `frontend/src/lib/modules/order-processing/OrderProcessing.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
  import { orderProcessingService } from './order-processing.service'
  import type { ProcessingOrder, LocalOrderState, ProcessedOrderEntry } from './data'
  import ProcessingTabFilter from './components/ProcessingTabFilter.svelte'
  import PendingOrderCard from './components/PendingOrderCard.svelte'
  import ProcessedOrderCard from './components/ProcessedOrderCard.svelte'
  import ProcessOrderDialog from './components/ProcessOrderDialog.svelte'

  let shopeeOrders = $state<ProcessingOrder[]>([])
  let localStates = $state<LocalOrderState[]>([])
  let activeTab = $state<'pending' | 'with_stock' | 'no_stock'>('pending')
  let selectedOrder = $state<ProcessingOrder | null>(null)
  let syncing = $state(false)
  let lastSyncedAt = $state('')
  let syncInterval: ReturnType<typeof setInterval> | null = null

  const stateMap = $derived(new Map(localStates.map(s => [s.orderId, s])))

  const pendingOrders = $derived(
    shopeeOrders.filter(o => o.status === 'ยังไม่ดำเนินการ' && !stateMap.has(o.orderId))
  )

  const withStockOrders = $derived(
    shopeeOrders
      .filter(o => stateMap.get(o.orderId)?.state === 'with_stock')
      .map(o => ({ ...o, localState: stateMap.get(o.orderId)! }) as ProcessedOrderEntry)
  )

  const noStockOrders = $derived(
    shopeeOrders
      .filter(o => stateMap.get(o.orderId)?.state === 'no_stock')
      .map(o => ({ ...o, localState: stateMap.get(o.orderId)! }) as ProcessedOrderEntry)
  )

  async function sync() {
    syncing = true
    const [ordersResult, statesResult] = await Promise.all([
      shopeeOrderService.getSummary().promise,
      orderProcessingService.getOrderStates().promise,
    ])

    if (ordersResult.isRight) {
      const data = ordersResult.getRight()
      shopeeOrders = (data.accounts ?? []).flatMap(acc =>
        acc.toShipOrders.map(o => ({
          ...o,
          accountName: acc.accountName,
          platform: acc.platform as string,
        }))
      )
    }

    if (statesResult.isRight) {
      localStates = statesResult.getRight()
    }

    lastSyncedAt = new Date().toISOString()
    syncing = false
  }

  function handleProcessed(state: LocalOrderState) {
    localStates = [...localStates.filter(s => s.orderId !== state.orderId), state]
    selectedOrder = null
  }

  function formatTime(iso: string): string {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  onMount(() => {
    sync()
    syncInterval = setInterval(sync, 5 * 60 * 1000)
  })

  onDestroy(() => {
    if (syncInterval) clearInterval(syncInterval)
  })
</script>

<div class="min-h-screen bg-grey-50 p-3 sm:p-6">
  <div class="max-w-3xl mx-auto">

    <div class="flex justify-between items-start gap-2 mb-5 sm:mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-grey-400">จัดการคำสั่งซื้อ</h1>
        {#if lastSyncedAt}
          <span class="text-grey-200 text-xs mt-1">อัปเดต: {formatTime(lastSyncedAt)}</span>
        {/if}
      </div>
      <button
        class="bg-primary-400 hover:bg-primary-500 text-white px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        onclick={sync}
        disabled={syncing}
      >
        {syncing ? '...' : 'Sync'}
      </button>
    </div>

    <div class="mb-6">
      <ProcessingTabFilter
        pendingCount={pendingOrders.length}
        withStockCount={withStockOrders.length}
        noStockCount={noStockOrders.length}
        {activeTab}
        onTabChange={(tab) => activeTab = tab as typeof activeTab}
      />
    </div>

    <div class="flex flex-col gap-3">
      {#if activeTab === 'pending'}
        {#if pendingOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">✅</div>
            <div class="text-sm">ไม่มีคำสั่งซื้อที่รอดำเนินการ</div>
          </div>
        {:else}
          {#each pendingOrders as order (order.orderId)}
            <PendingOrderCard {order} onClick={() => selectedOrder = order} />
          {/each}
        {/if}

      {:else if activeTab === 'with_stock'}
        {#if withStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each withStockOrders as order (order.orderId)}
            <ProcessedOrderCard {order} />
          {/each}
        {/if}

      {:else}
        {#if noStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each noStockOrders as order (order.orderId)}
            <ProcessedOrderCard {order} />
          {/each}
        {/if}
      {/if}
    </div>

  </div>
</div>

{#if selectedOrder}
  <ProcessOrderDialog
    order={selectedOrder}
    onClose={() => selectedOrder = null}
    onProcessed={handleProcessed}
  />
{/if}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 3: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/lib/modules/order-processing/OrderProcessing.svelte && git commit -m "feat: add OrderProcessing root component with 3-tab layout and sync"
```

---

### Task 10: Frontend — Wire root page

**Files:**
- Modify: `frontend/src/routes/+page.svelte`

- [ ] **Step 1: Replace root page content**

Replace all contents of `frontend/src/routes/+page.svelte` with:

```svelte
<script lang="ts">
  import OrderProcessing from '$lib/modules/order-processing/OrderProcessing.svelte'
</script>

<OrderProcessing />
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npm run check 2>&1 | tail -10
```

Expected: 0 ERRORS

- [ ] **Step 3: Backend build final check**

```bash
cd backend && npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/khunboss/Documents/lonelyuniverse/lonely-shopee-monitor && git add frontend/src/routes/+page.svelte && git commit -m "feat: mount OrderProcessing on root page - order processing feature complete"
```
