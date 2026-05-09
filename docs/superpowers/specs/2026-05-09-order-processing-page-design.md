# Design: Order Processing Page (Root `/`)

**Date:** 2026-05-09
**Status:** Approved

## Overview

A new root page (`/`) that pulls order data from the existing Shopee API and lets staff process each order by marking it as "มีของ" (has stock) or "ไม่มีของ" (no stock). Processing state is persisted in the backend. The page is independent from the real-data dashboard at `/admin/v1/shopee/real-data`.

## Data Flow & State Model

```
Shopee API (/api/orders/summary)
        ↓ fetch on load + every 5 min + manual sync
  [Order Processing Page]
        ↓ merged with
  /api/order-states  ← JSON file: data/order-states.json
```

### LocalOrderState (stored in `data/order-states.json`)

```ts
interface LocalOrderState {
  orderId: string
  state: 'with_stock' | 'no_stock'
  reason?: 'out_of_stock' | 'different_variant'
  imageUrls: string[]   // relative paths on server
  processedAt: string   // ISO timestamp
}
```

### Tab Display Logic

| Tab | Condition |
|-----|-----------|
| ยังไม่ดำเนินการ | Shopee status = unprocessed **AND** no entry in order-states |
| ดำเนินการแล้ว (มีสินค้า) | entry in order-states with state = `with_stock` |
| ดำเนินการแล้ว (ไม่มีสินค้า) | entry in order-states with state = `no_stock` |
| Hidden (auto) | Shopee reports order as "ดำเนินการแล้ว" (shipped) — removed from all tabs |

## Backend

### New Files

| File | Purpose |
|------|---------|
| `infrastructure/order-state.store.ts` | Read/write `data/order-states.json` |
| `routes/order-state.routes.ts` | HTTP routes for state + file upload |

### New Routes

```
GET  /api/order-states
     → returns LocalOrderState[]

POST /api/order-states/:orderId
     body: { state, reason?, imageUrls[] }
     → saves order state

POST /api/uploads/:orderId
     multipart/form-data (field: images, multiple)
     → saves files to:
       /Volumes/public/lonely-monitor/image-verify/DD-MM-YYYY/{orderId}/
     → returns { imageUrls: string[] }
```

### Dependencies

- `multer` — multipart upload handling

### `index.ts` changes

- Instantiate `OrderStateStore`
- Mount `createOrderStateRoutes(orderStateStore)` at `/api/order-states`
- Mount upload route at `/api/uploads`

## Frontend

### New Module: `src/lib/modules/order-processing/`

```
order-processing/
├── OrderProcessing.svelte         ← root (tabs + sync logic)
├── data.ts                        ← types
├── order-processing.service.ts    ← HTTP calls
└── components/
    ├── ProcessingTabFilter.svelte  ← 3-tab bar
    ├── PendingOrderCard.svelte     ← clickable card (pending tab)
    ├── ProcessedOrderCard.svelte   ← read-only card (processed tabs)
    └── ProcessOrderDialog.svelte  ← modal: มีของ/ไม่มีของ + upload
```

### Root Page (`src/routes/+page.svelte`)

```svelte
<script>
  import OrderProcessing from '$lib/modules/order-processing/OrderProcessing.svelte'
</script>
<OrderProcessing />
```

### Sync Logic (`OrderProcessing.svelte`)

- `onMount` → parallel fetch: Shopee orders + order-states
- `setInterval` 5 minutes → re-fetch both
- Manual sync button → same fetch, clears interval and restarts it

## User Flow: ProcessOrderDialog

### Entry

Click a card in "ยังไม่ดำเนินการ" tab → dialog opens showing:
- Product image(s), name, variant, quantity for each item in the order

### Path A — "มีของ"

1. Upload zone appears (multiple files, **required**)
2. Preview shown after selection
3. Confirm button active only when ≥1 image uploaded
4. On confirm:
   - `POST /api/uploads/:orderId`
   - `POST /api/order-states/:orderId` `{ state: 'with_stock', imageUrls }`
   - Order moves to "ดำเนินการแล้ว (มีสินค้า)" tab

### Path B — "ไม่มีของ"

1. Reason dropdown appears:
   - `out_of_stock` → "สินค้าหมด" (upload **optional**)
   - `different_variant` → "มีสินค้า (สี/ไซซ์/ขนาด) อื่น แต่แบบเดียวกัน" (upload **required**)
2. Upload zone shown (required/optional based on reason)
3. Preview shown after selection
4. Confirm button active when: reason selected AND upload requirement satisfied
5. On confirm:
   - `POST /api/uploads/:orderId` (if images present)
   - `POST /api/order-states/:orderId` `{ state: 'no_stock', reason, imageUrls }`
   - Order moves to "ดำเนินการแล้ว (ไม่มีสินค้า)" tab

## Image Storage

Path pattern: `/Volumes/public/lonely-monitor/image-verify/DD-MM-YYYY/{orderId}/`

Example: `/Volumes/public/lonely-monitor/image-verify/09-05-2026/250509ABC123DEF/image1.jpg`

Date is the date of processing (server time, Thai date format DD-MM-YYYY).

## Out of Scope

- Authentication/authorization on the new page
- Editing or undoing a processed order state
- Pagination (assumes order count is manageable for a monitor app)
- Push notifications when new orders arrive
