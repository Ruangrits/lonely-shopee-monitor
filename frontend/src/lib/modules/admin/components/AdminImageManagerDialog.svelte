<script lang="ts">
  import { adminService } from '../admin.service'

  let { orderId, existingImageUrls, onSave, onClose }: {
    orderId: string
    existingImageUrls: string[]
    onSave: (urls: string[]) => void
    onClose: () => void
  } = $props()

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001')

  let keepUrls = $state([...existingImageUrls])
  let pendingFiles = $state<File[]>([])
  let pendingPreviews = $state<string[]>([])
  let saving = $state(false)
  let errorMsg = $state('')

  $effect(() => {
    return () => {
      for (const url of pendingPreviews) URL.revokeObjectURL(url)
    }
  })

  function addFiles(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files) return
    const newFiles = Array.from(input.files)
    pendingFiles = [...pendingFiles, ...newFiles]
    pendingPreviews = [...pendingPreviews, ...newFiles.map(f => URL.createObjectURL(f))]
    input.value = ''
  }

  function removeExisting(index: number) {
    keepUrls = keepUrls.filter((_, i) => i !== index)
  }

  function removePending(index: number) {
    URL.revokeObjectURL(pendingPreviews[index])
    pendingFiles = pendingFiles.filter((_, i) => i !== index)
    pendingPreviews = pendingPreviews.filter((_, i) => i !== index)
  }

  async function save() {
    saving = true
    errorMsg = ''
    try {
      let newUrls: string[] = []
      if (pendingFiles.length > 0) {
        const uploaded = await adminService.uploadImages(orderId, pendingFiles)
        newUrls = uploaded.imageUrls
      }
      onSave([...keepUrls, ...newUrls])
    } catch {
      errorMsg = 'อัพโหลดไม่สำเร็จ กรุณาลองใหม่'
      saving = false
    }
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
      <h2 class="text-grey-400 font-bold text-base">จัดการรูปภาพ</h2>
      <button class="text-grey-300 hover:text-grey-400 p-1 text-lg" onclick={onClose} aria-label="ปิด">✕</button>
    </div>

    <div class="px-4 py-4">

      <!-- Image grid -->
      {#if keepUrls.length > 0 || pendingPreviews.length > 0}
        <div class="text-xs text-grey-300 mb-2 font-semibold">
          รูปภาพ ({keepUrls.length + pendingPreviews.length} ใบ)
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          {#each keepUrls as url, i}
            <div class="relative">
              <button
                class="w-full aspect-square rounded-lg overflow-hidden border border-grey-100 block bg-grey-50"
                onclick={() => window.open(`${API_BASE}/api/images/${url}`, '_blank')}
                aria-label="ดูรูปภาพ {i + 1}"
              >
                <img
                  src="{API_BASE}/api/images/{url}"
                  alt="รูปภาพ {i + 1}"
                  class="w-full h-full object-cover"
                />
              </button>
              <button
                class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
                onclick={() => removeExisting(i)}
                aria-label="ลบรูป {i + 1}"
              >✕</button>
            </div>
          {/each}
          {#each pendingPreviews as preview, i}
            <div class="relative">
              <img src={preview} alt="รูปใหม่ {i + 1}" class="w-full aspect-square object-cover rounded-lg border-2 border-primary-200" />
              <button
                class="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
                onclick={() => removePending(i)}
                aria-label="ลบรูปใหม่ {i + 1}"
              >✕</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center text-grey-300 text-sm py-4 mb-4">ยังไม่มีรูปภาพ</div>
      {/if}

      <!-- Note -->
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-700 mb-4">
        💡 กด ✕ บนรูปเพื่อเอาออกจากรายการ (ไม่ลบจาก NAS)
      </div>

      <!-- Mobile: camera + file picker (2 buttons) -->
      <div class="grid grid-cols-2 gap-3 sm:hidden mb-3">
        <label class="flex flex-col items-center justify-center gap-1.5 bg-primary-50 border-2 border-primary-200 rounded-xl py-4 cursor-pointer hover:bg-primary-100 transition-colors">
          <input type="file" accept="image/*" capture="environment" class="hidden" onchange={addFiles} aria-label="ถ่ายรูป" />
          <span class="text-2xl">📸</span>
          <span class="text-primary-400 text-xs font-semibold">ถ่ายรูป</span>
        </label>
        <label class="flex flex-col items-center justify-center gap-1.5 bg-grey-50 border-2 border-dashed border-grey-200 rounded-xl py-4 cursor-pointer hover:bg-grey-100 transition-colors">
          <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} aria-label="เลือกไฟล์" />
          <span class="text-2xl">📁</span>
          <span class="text-grey-300 text-xs font-semibold">เลือกไฟล์</span>
        </label>
      </div>

      <!-- Desktop: drag-and-drop area -->
      <label class="hidden sm:flex flex-col items-center justify-center border-2 border-dashed border-grey-200 rounded-xl p-5 cursor-pointer hover:bg-grey-50 transition-colors mb-3">
        <input type="file" accept="image/*" multiple class="hidden" onchange={addFiles} aria-label="อัพโหลดรูปภาพ" />
        <span class="text-2xl mb-2">📤</span>
        <span class="text-grey-300 text-sm">คลิก หรือลากไฟล์มาวางที่นี่</span>
        <span class="text-grey-200 text-xs mt-1">jpg, png, webp · ≤ 10MB</span>
      </label>

      <!-- Error -->
      {#if errorMsg}
        <div class="p-3 bg-danger-50 text-danger-200 text-sm rounded-lg mb-3">{errorMsg}</div>
      {/if}

      <!-- Save button -->
      <button
        class="w-full py-3 rounded-xl font-semibold text-sm transition-colors
          {saving ? 'bg-grey-100 text-grey-300 cursor-not-allowed' : 'bg-primary-400 hover:bg-primary-500 text-white'}"
        disabled={saving}
        onclick={save}
      >
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>

    </div>
  </div>
</div>
