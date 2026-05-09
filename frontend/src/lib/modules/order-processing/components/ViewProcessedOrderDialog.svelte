<script lang="ts">
  import type { Order } from '$lib/modules/dashboard/data'
  import type { LocalOrderState } from '../data'

  let { order, localState, onClose }: {
    order: Order
    localState: LocalOrderState
    onClose: () => void
  } = $props()

  const stateLabel = $derived(localState.state === 'with_stock' ? 'มีของ' : 'ไม่มีของ')
  const stateStyle = $derived(
    localState.state === 'with_stock'
      ? 'bg-success-50 text-success-200 border-success-100'
      : 'bg-danger-50 text-danger-200 border-danger-100'
  )
  const reasonLabel = $derived(
    localState.reason === 'out_of_stock' ? 'สินค้าหมด' :
    localState.reason === 'different_variant' ? 'มีสินค้า (สี/ไซซ์/ขนาด) อื่น แต่แบบเดียวกัน' : ''
  )
  const processedTime = $derived(() => {
    try {
      return new Date(localState.processedAt).toLocaleString('th-TH', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    } catch { return localState.processedAt }
  })
</script>

<div
  class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
  onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
  role="dialog"
  aria-modal="true"
  tabindex={-1}
>
  <div class="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">

    <!-- Handle (mobile) -->
    <div class="flex justify-center pt-3 pb-1 sm:hidden">
      <div class="w-10 h-1 bg-grey-200 rounded-full"></div>
    </div>

    <!-- Header -->
    <div class="flex justify-between items-center px-4 py-3 border-b border-grey-100">
      <div class="flex items-center gap-2">
        <h2 class="text-grey-400 font-bold text-base">รายละเอียดคำสั่งซื้อ</h2>
        <span class="text-2xs px-2 py-1 rounded-full font-semibold border {stateStyle}">{stateLabel}</span>
      </div>
      <button class="text-grey-300 hover:text-grey-400 p-1 text-lg" onclick={onClose} aria-label="ปิด">✕</button>
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

    <!-- Processing result -->
    <div class="px-4 py-4 space-y-3">

      {#if reasonLabel}
        <div class="flex items-start gap-2">
          <span class="text-grey-200 text-xs shrink-0 mt-0.5">สาเหตุ:</span>
          <span class="text-danger-200 text-sm font-medium">{reasonLabel}</span>
        </div>
      {/if}

      {#if localState.imageUrls.length > 0}
        <div class="flex items-center gap-2">
          <span class="text-grey-200 text-xs">รูปแนบ:</span>
          <span class="text-grey-400 text-sm font-medium">{localState.imageUrls.length} ใบ</span>
        </div>
      {/if}

      {#if localState.note}
        <div class="bg-grey-50 rounded-lg p-3">
          <div class="text-grey-200 text-xs mb-1">โน้ต</div>
          <div class="text-grey-400 text-sm whitespace-pre-wrap">{localState.note}</div>
        </div>
      {/if}

      <div class="text-grey-200 text-xs">
        ดำเนินการเมื่อ: {processedTime()}
      </div>

    </div>

  </div>
</div>
