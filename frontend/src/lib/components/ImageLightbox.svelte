<script lang="ts">
  let { src, alt, onClose }: { src: string; alt: string; onClose: () => void } = $props()
</script>

<div
  class="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4"
  onclick={(e) => { if (e.target === e.currentTarget) onClose() }}
  onkeydown={(e) => { if (e.key === 'Escape') onClose() }}
  role="dialog"
  aria-modal="true"
  tabindex={-1}
>
  <button
    class="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
    onclick={onClose}
    aria-label="ปิด"
  >✕</button>
  <img
    {src}
    {alt}
    class="max-w-full max-h-[90vh] object-contain rounded-lg"
  />
</div>
