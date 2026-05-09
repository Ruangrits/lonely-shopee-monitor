<script lang="ts">
  import type { Order } from '$lib/modules/dashboard/data'
  import type { LocalOrderState, NoStockReason } from '$lib/modules/order-processing/data'
  import { adminService } from '../admin.service'
  import AdminImageManagerDialog from './AdminImageManagerDialog.svelte'

  let { order, localState, onClose, onUpdated }: {
    order: Order
    localState: LocalOrderState | null
    onClose: () => void
    onUpdated: () => void
  } = $props()

  type SheetMode = 'main' | 'change_status'
  let mode = $state<SheetMode>('main')
  let newState = $state<'with_stock' | 'no_stock'>('with_stock')
  let newReason = $state<NoStockReason | ''>('')
  let newNote = $state(localState?.note ?? '')
  let submitting = $state(false)
  let errorMsg = $state('')
  let showImageManager = $state(false)

  const orderState = $derived(localState?.state ?? 'pending')

  async function markPending() {
    submitting = true
    errorMsg = ''
    try {
      const result = await adminService.deleteOrderState(order.orderId).promise
      if (result.isRight) {
        onUpdated()
      } else {
        errorMsg = 'ดำเนินการไม่สำเร็จ'
      }
    } catch {
      errorMsg = 'เกิดข้อผิดพลาด'
    } finally {
      submitting = false
    }
  }

  async function markAdminCompleted() {
    submitting = true
    errorMsg = ''
    try {
      const payload = {
        state: 'admin_completed' as const,
        reason: localState?.reason,
        imageUrls: localState?.imageUrls ?? [],
        note: localState?.note,
      }
      const result = localState
        ? await adminService.updateOrderState(order.orderId, payload).promise
        : await adminService.createOrderState(order.orderId, payload).promise
      if (result.isRight) {
        onUpdated()
      } else {
        errorMsg = 'ดำเนินการไม่สำเร็จ'
      }
    } catch {
      errorMsg = 'เกิดข้อผิดพลาด'
    } finally {
      submitting = false
    }
  }

  async function confirmChangeStatus() {
    submitting = true
    errorMsg = ''
    try {
      const payload = {
        state: newState,
        reason: newState === 'no_stock' ? (newReason as NoStockReason) || undefined : undefined,
        imageUrls: localState?.imageUrls ?? [],
        note: newNote.trim() || undefined,
      }
      const result = await adminService.updateOrderState(order.orderId, payload).promise
      if (result.isRight) {
        onUpdated()
      } else {
        errorMsg = 'ดำเนินการไม่สำเร็จ'
      }
    } catch {
      errorMsg = 'เกิดข้อผิดพลาด'
    } finally {
      submitting = false
    }
  }

  async function handleImageSave(urls: string[]) {
    if (!localState) return
    try {
      const payload = {
        state: localState.state,
        reason: localState.reason,
        imageUrls: urls,
        note: localState.note,
      }
      await adminService.updateOrderState(order.orderId, payload).promise
      showImageManager = false
      onUpdated()
    } catch {
      errorMsg = 'บันทึกรูปภาพไม่สำเร็จ'
      showImageManager = false
    }
  }
</script>

{#if showImageManager && localState}
  <AdminImageManagerDialog
    orderId={order.orderId}
    existingImageUrls={localState.imageUrls}
    onSave={handleImageSave}
    onClose={() => showImageManager = false}
  />
{:else}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
    onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
    onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
    role="dialog"
    aria-modal="true"
    tabindex={-1}
  >
    <div class="bg-white w-full max-w-lg rounded-t-2xl px-4 pb-6 pt-3">

      <!-- Handle -->
      <div class="flex justify-center mb-3">
        <div class="w-10 h-1 bg-grey-200 rounded-full"></div>
      </div>

      <!-- Order ID + state label -->
      <div class="text-xs text-grey-300 text-center mb-4">
        #{order.orderId}
        {#if orderState === 'pending'}· รอดำเนินการ
        {:else if orderState === 'with_stock'}· มีของ
        {:else if orderState === 'no_stock'}· ไม่มีของ
        {:else}· เสร็จสิ้น{/if}
      </div>

      {#if errorMsg}
        <div class="p-3 bg-danger-50 text-danger-200 text-sm rounded-lg mb-3">{errorMsg}</div>
      {/if}

      {#if mode === 'main'}
        <div class="flex flex-col gap-2">

          {#if orderState === 'pending'}
            <button
              class="text-left px-4 py-3 bg-success-50 text-success-200 border border-success-100 rounded-xl text-sm font-semibold hover:bg-success-100 transition-colors disabled:opacity-50"
              disabled={submitting}
              onclick={markAdminCompleted}
            >✓ ดำเนินการหลังบ้านแล้ว</button>

          {:else if orderState === 'with_stock' || orderState === 'no_stock'}
            <button
              class="text-left px-4 py-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-semibold hover:bg-orange-100 transition-colors disabled:opacity-50"
              disabled={submitting}
              onclick={markPending}
            >↩ ย้ายกลับรอดำเนินการ</button>
            <button
              class="text-left px-4 py-3 bg-success-50 text-success-200 border border-success-100 rounded-xl text-sm font-semibold hover:bg-success-100 transition-colors disabled:opacity-50"
              disabled={submitting}
              onclick={markAdminCompleted}
            >✓ ดำเนินการหลังบ้านแล้ว</button>
            <button
              class="text-left px-4 py-3 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-semibold hover:bg-purple-100 transition-colors"
              onclick={() => {
                mode = 'change_status'
                errorMsg = ''
                newState = orderState === 'with_stock' ? 'no_stock' : 'with_stock'
                newNote = localState?.note ?? ''
              }}
            >🔄 เปลี่ยน status</button>
            <button
              class="text-left px-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-semibold hover:bg-blue-100 transition-colors"
              onclick={() => showImageManager = true}
            >📷 จัดการรูปภาพ ({localState?.imageUrls.length ?? 0} ใบ)</button>

          {:else if orderState === 'admin_completed'}
            <button
              class="text-left px-4 py-3 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-semibold hover:bg-orange-100 transition-colors disabled:opacity-50"
              disabled={submitting}
              onclick={markPending}
            >↩ ย้ายกลับรอดำเนินการ</button>
          {/if}

          <button
            class="text-left px-4 py-3 bg-white text-grey-300 border border-grey-100 rounded-xl text-sm hover:bg-grey-50 transition-colors"
            onclick={onClose}
          >ยกเลิก</button>
        </div>

      {:else}
        <!-- Inline change-status section -->
        <div class="flex items-center gap-2 mb-4">
          <button class="text-grey-300 text-sm hover:text-grey-400" onclick={() => { mode = 'main'; errorMsg = '' }} aria-label="กลับ">← กลับ</button>
          <span class="text-grey-400 font-semibold text-sm">เปลี่ยน status</span>
        </div>

        <div class="flex gap-2 mb-4">
          <button
            class="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors
              {newState === 'with_stock' ? 'border-success-200 bg-success-50 text-success-200' : 'border-grey-200 text-grey-300 hover:bg-grey-50'}"
            onclick={() => newState = 'with_stock'}
          >มีของ</button>
          <button
            class="flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors
              {newState === 'no_stock' ? 'border-danger-200 bg-danger-50 text-danger-200' : 'border-grey-200 text-grey-300 hover:bg-grey-50'}"
            onclick={() => newState = 'no_stock'}
          >ไม่มีของ</button>
        </div>

        {#if newState === 'no_stock'}
          <select
            class="w-full border border-grey-200 rounded-lg px-3 py-2 text-sm text-grey-400 mb-4 focus:outline-none focus:border-primary-300"
            bind:value={newReason}
          >
            <option value="">เลือกสาเหตุ (ไม่บังคับ)</option>
            <option value="out_of_stock">สินค้าหมด</option>
            <option value="different_variant">มีสินค้า (สี/ไซซ์/ขนาด) อื่น แต่แบบเดียวกัน</option>
          </select>
        {/if}

        <div class="mb-4">
          <label for="change-status-note" class="block text-grey-300 text-xs mb-1.5">โน้ต (ไม่บังคับ)</label>
          <textarea
            id="change-status-note"
            class="w-full border border-grey-200 rounded-lg px-3 py-2 text-sm text-grey-400 resize-none focus:outline-none focus:border-primary-300"
            rows={2}
            placeholder="เพิ่มข้อความสำหรับออเดอร์นี้..."
            bind:value={newNote}
          ></textarea>
        </div>

        <button
          class="w-full py-3 rounded-xl font-semibold text-sm transition-colors
            {submitting ? 'bg-grey-100 text-grey-300 cursor-not-allowed' : 'bg-primary-400 hover:bg-primary-500 text-white'}"
          disabled={submitting}
          onclick={confirmChangeStatus}
        >
          {submitting ? 'กำลังบันทึก...' : 'ยืนยัน'}
        </button>
      {/if}

    </div>
  </div>
{/if}
