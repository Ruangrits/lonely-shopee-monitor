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

  $effect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url)
    }
  })

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
      <h2 class="text-grey-400 font-bold text-base">รายละเอียดคำสั่งซื้อ</h2>
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
          <button class="text-grey-300 text-sm hover:text-grey-400" onclick={() => { step = 'choose'; selectedFiles = []; previews = [] }} aria-label="กลับ">← กลับ</button>
          <span class="text-success-200 font-semibold text-sm">มีของ — แนบรูปสินค้า</span>
        </div>
        <label for="upload-with-stock" class="block border-2 border-dashed border-primary-200 rounded-xl p-4 text-center cursor-pointer hover:bg-primary-50 transition-colors">
          <input id="upload-with-stock" type="file" accept="image/*" multiple class="hidden" onchange={addFiles} aria-label="อัพโหลดรูปสินค้า" />
          <div class="text-grey-300 text-sm">กดเพื่อเลือกรูป (ได้หลายใบ)</div>
          <div class="text-primary-400 text-xs mt-1">* จำเป็นต้องแนบอย่างน้อย 1 รูป</div>
        </label>

      {:else if step === 'no_stock'}
        <div class="flex items-center gap-2 mb-4">
          <button class="text-grey-300 text-sm hover:text-grey-400" onclick={() => { step = 'choose'; noStockReason = ''; selectedFiles = []; previews = [] }} aria-label="กลับ">← กลับ</button>
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

        <label for="upload-no-stock" class="block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
          {noStockReason === 'different_variant' ? 'border-danger-200 hover:bg-danger-50' : 'border-grey-200 hover:bg-grey-50'}">
          <input id="upload-no-stock" type="file" accept="image/*" multiple class="hidden" onchange={addFiles} aria-label="อัพโหลดรูปประกอบ" />
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
              <img src={preview} alt="รูปสินค้าที่อัพโหลด {i + 1}" class="w-full aspect-square object-cover rounded-lg border border-grey-100" />
              <button
                class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
                onclick={() => removeFile(i)}
              >✕</button>
            </div>
          {/each}
          {#if step !== 'choose'}
            <label class="aspect-square border-2 border-dashed border-grey-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-grey-50" aria-label="เพิ่มรูป">
              <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} aria-label="เพิ่มรูป" />
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
