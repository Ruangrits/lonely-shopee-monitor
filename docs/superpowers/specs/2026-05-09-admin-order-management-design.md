# Admin Order Management Page Design

## Goal

Build an admin page at `/admin` where administrators can manage all order processing states: move orders back to pending, mark orders as backend-completed, change status, manage evidence images (upload/delete/view/take photo), and run manual cleanup of old records.

## Architecture

The admin page reuses the existing `OrderStateStore` and `orderProcessingService` infrastructure. The only new backend concerns are: adding `admin_completed` as a valid state, adding `PUT`/`DELETE`/cleanup endpoints, and serving uploaded images as static files. The frontend adds a new SvelteKit route `/admin` with its own module.

**Tech Stack:** Node.js/TypeScript, Express, Svelte 5 runes, Tailwind CSS, `capture="environment"` for mobile camera

---

## Data Model Changes

### `LocalOrderState.state` — add `admin_completed`

```typescript
// backend/src/infrastructure/order-state.store.ts
// frontend/src/lib/modules/order-processing/data.ts
state: 'with_stock' | 'no_stock' | 'admin_completed'
```

- `admin_completed` = admin has confirmed this order is fully handled in Shopee backend
- Main page (`/`) hides orders where `localState.state === 'admin_completed'`
- Admin page shows all 4 states: pending (no localState), with_stock, no_stock, admin_completed

### `OrderStateStore` — add `cleanup()` and `delete()`

```typescript
// New methods on OrderStateStore
delete(orderId: string): boolean          // remove entry → order returns to pending
cleanup(olderThanDays: number): number    // remove admin_completed entries older than N days, returns count
```

Auto-cleanup runs on server start with 30 days threshold.

---

## Image URL Format Change

Currently uploads return absolute filesystem paths (`/Volumes/public/.../1234.jpg`) that browsers cannot load. This must be fixed:

**Upload endpoint** returns relative paths:
```typescript
// order-state.routes.ts (createUploadRoutes)
// Before: files.map(f => f.path)
// After:
const imageUrls = files.map(f => path.relative(IMAGE_BASE, f.path))
// → "09-05-2026/orderId/1234567890.jpg"
```

**Static file serving** added in `index.ts`:
```typescript
app.use('/api/images', express.static(IMAGE_BASE))
// Frontend: <img src="/api/images/09-05-2026/orderId/1234.jpg">
```

**Backward compatibility:** Existing entries with absolute paths will render as broken images in the admin UI. No migration required (early-stage deployment).

---

## Backend API

### New/changed endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/order-states/:orderId` | Update state/reason/imageUrls/note for an existing entry |
| `DELETE` | `/api/order-states/:orderId` | Delete entry (order returns to pending on main page) |
| `POST` | `/api/order-states/cleanup` | Delete admin_completed entries older than 30 days, returns `{ deleted: number }` |
| Static | `/api/images/*` | Serve image files from IMAGE_BASE directory |

### `PUT /api/order-states/:orderId`

Accepts same body as `POST`, overwrites existing entry. Returns 200 with updated state. Validates same rules as POST.

### `DELETE /api/order-states/:orderId`

Removes entry from store and persists. Returns 204 No Content. Returns 404 if not found.

### `POST /api/order-states/cleanup`

Calls `store.cleanup(30)`. Returns `{ deleted: number }`.

---

## Frontend Structure

### New files

```
frontend/src/routes/admin/+page.svelte           — mounts <Admin />
frontend/src/lib/modules/admin/
  Admin.svelte                                    — root: tabs, sync, cleanup button
  admin.service.ts                                — PUT/DELETE/cleanup API calls
  components/
    AdminTabFilter.svelte                         — 4 tabs: pending/with_stock/no_stock/admin_completed
    AdminActionSheet.svelte                       — bottom sheet with context actions
    AdminImageManagerDialog.svelte                — view/upload/take-photo/remove images
```

### Modified files

```
frontend/src/lib/modules/order-processing/data.ts                           — add admin_completed to union
frontend/src/lib/modules/order-processing/order-processing.service.ts      — (no change needed)
frontend/src/lib/modules/order-processing/components/ProcessOrderDialog.svelte — add camera button
backend/src/infrastructure/order-state.store.ts    — add delete(), cleanup(), update state type
backend/src/routes/order-state.routes.ts           — add PUT, DELETE, cleanup routes; fix image URL; add admin_completed to valid states
backend/src/index.ts                               — add static serving, call cleanup on startup
```

---

## Admin Page (`Admin.svelte`)

### Tab layout

4 tabs using `AdminTabFilter`:

| Tab | Filter |
|-----|--------|
| รอดำเนินการ | orders from Shopee with no localState |
| มีของ | `localState.state === 'with_stock'` |
| ไม่มีของ | `localState.state === 'no_stock'` |
| เสร็จสิ้น | `localState.state === 'admin_completed'` |

### Header

```
จัดการออเดอร์ (Admin)          [ลบประวัติเก่า]  [Sync]
อัปเดต: 16:30
```

"ลบประวัติเก่า" button calls `POST /api/order-states/cleanup` and shows toast: "ลบ {n} รายการเก่าแล้ว"

### Card display

Reuses existing `OrderCard` from dashboard (same as main page), wrapped in a `<button>` that opens `AdminActionSheet`. Status badge for admin_completed tab shows "เสร็จสิ้น" (grey style).

### Sync

Same pattern as main page: `refreshOrders()` + `getOrderStates()` in parallel on mount and every 5 min.

---

## Action Sheet (`AdminActionSheet.svelte`)

Bottom sheet (same style as `ProcessOrderDialog`). Actions are context-dependent:

### Pending orders (no localState)
- **✓ ดำเนินการหลังบ้านแล้ว** → `POST /api/order-states/:orderId` with `{ state: 'admin_completed', imageUrls: [] }`

### with_stock / no_stock orders
- **↩ ย้ายกลับรอดำเนินการ** → `DELETE /api/order-states/:orderId`
- **✓ ดำเนินการหลังบ้านแล้ว** → `PUT /api/order-states/:orderId` with `{ ...existing, state: 'admin_completed' }`
- **🔄 เปลี่ยน status** → the action sheet expands in-place to show a sub-section: new state selector (with_stock / no_stock), reason dropdown (shown only when switching to no_stock), optional note field, and a "ยืนยัน" button. On confirm: `PUT /api/order-states/:orderId` with updated state/reason/note. No new dialog opened — stays within the action sheet.
- **📷 จัดการรูปภาพ ({n} ใบ)** → opens `AdminImageManagerDialog`
- **ยกเลิก** → close sheet

### admin_completed orders
- **↩ ย้ายกลับรอดำเนินการ** → `DELETE /api/order-states/:orderId`
- **ยกเลิก** → close sheet

---

## Image Manager (`AdminImageManagerDialog.svelte`)

### Mobile layout (default)
- Image grid: 3 columns, each image has ✕ button to remove from list
- Two action buttons side-by-side:
  - **📸 ถ่ายรูป** → `<input type="file" accept="image/*" capture="environment">` (opens camera on mobile)
  - **📁 เลือกไฟล์** → `<input type="file" accept="image/*" multiple>` (file picker)
- "บันทึก" button → `PUT /api/order-states/:orderId` with updated imageUrls, then upload new files first via `POST /api/uploads/:orderId`

### Desktop layout (`sm:` breakpoint)
- Image grid: 4 columns
- Drag-and-drop upload area (click or drag)
- No camera button shown on desktop (capture attribute ignored by desktop browsers anyway)

### Image display
- `<img src="/api/images/{relativePath}">` served from backend static
- Tap image → lightbox view (full size in new tab via `window.open`)
- ✕ on image → removes from local `imageUrls` array (not persisted until "บันทึก")

### Upload flow
1. User selects/takes photo → added to pending files list with blob URL preview
2. User presses "บันทึก"
3. Upload new files: `POST /api/uploads/:orderId` → returns new relative paths
4. Merge with existing kept imageUrls
5. `PUT /api/order-states/:orderId` with final imageUrls array
6. Revoke blob URLs, close dialog

---

## ProcessOrderDialog — Camera Button Addition

In both `with_stock` and `no_stock` steps, add a camera button alongside the existing file upload:

```svelte
<!-- Mobile: two buttons side by side -->
<div class="grid grid-cols-2 gap-3 sm:hidden">
  <label class="...camera-style...">
    <input type="file" accept="image/*" capture="environment" class="hidden" onchange={addFiles} />
    📸 ถ่ายรูป
  </label>
  <label class="...upload-style...">
    <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} />
    📁 เลือกไฟล์
  </label>
</div>
<!-- Desktop: original upload area only -->
<label class="hidden sm:block ...original-upload-style...">
  <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} />
  ...
</label>
```

---

## Cleanup Logic

### Auto-cleanup (server start)

```typescript
// index.ts — after OrderStateStore instantiation
orderStateStore.cleanup(30)
console.log('Auto-cleanup: removed admin_completed entries older than 30 days')
```

### `OrderStateStore.cleanup(days)`

```typescript
cleanup(olderThanDays: number): number {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  let deleted = 0
  for (const [id, state] of this.states) {
    if (state.state === 'admin_completed' && new Date(state.processedAt).getTime() < cutoff) {
      this.states.delete(id)
      deleted++
    }
  }
  if (deleted > 0) this.persist()
  return deleted
}
```

---

## `admin.service.ts`

```typescript
import { Blizzard } from 'th-lonely-universe-web-lib/blizzard'
import { Either } from 'th-lonely-universe-web-lib/fp'
import type { Future } from 'th-lonely-universe-web-lib/async'
import type { LocalOrderState } from '$lib/modules/order-processing/data'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001')

const client = Blizzard(API_BASE, { 'Content-Type': 'application/json' })

export const adminService = {
  updateOrderState(
    orderId: string,
    payload: { state: LocalOrderState['state']; reason?: LocalOrderState['reason']; imageUrls: string[]; note?: string }
  ): Future<unknown, LocalOrderState> {
    return client.put(`/api/order-states/${orderId}`)
      .withBody(JSON.stringify(payload)).fetch().readToJson()
      .deserialize<unknown, LocalOrderState>((j) => Either.Right(j as LocalOrderState)).toFuture()
  },

  deleteOrderState(orderId: string): Future<unknown, void> {
    return client.delete(`/api/order-states/${orderId}`)
      .fetch().readToJson()
      .deserialize<unknown, void>(() => Either.Right(undefined)).toFuture()
  },

  cleanup(): Future<unknown, { deleted: number }> {
    return client.post('/api/order-states/cleanup').withBody('{}').fetch().readToJson()
      .deserialize<unknown, { deleted: number }>((j) => Either.Right(j as { deleted: number })).toFuture()
  },
}
```

Uses same `API_BASE` pattern as `orderProcessingService`.

---

## Routing

`frontend/src/routes/admin/+page.svelte` mounts `<Admin />` — no auth gate (same as main page, internal NAS deployment).

The existing `/admin/v1/shopee/real-data` route is unaffected (different directory depth).

---

## Out of Scope

- Authentication/authorization on admin page
- Physical file deletion from NAS (only removes URL reference from store)
- Pagination (acceptable for NAS internal deployment with limited order volume)
- Push notifications for new orders
