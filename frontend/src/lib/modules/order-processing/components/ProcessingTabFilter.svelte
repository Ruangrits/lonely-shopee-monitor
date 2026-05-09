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
