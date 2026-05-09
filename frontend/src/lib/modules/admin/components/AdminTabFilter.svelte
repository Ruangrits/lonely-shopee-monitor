<script lang="ts">
  type Tab = 'pending' | 'with_stock' | 'no_stock' | 'admin_completed'

  let { activeTab, pendingCount, withStockCount, noStockCount, adminCompletedCount, onTabChange }: {
    activeTab: Tab
    pendingCount: number
    withStockCount: number
    noStockCount: number
    adminCompletedCount: number
    onTabChange: (tab: Tab) => void
  } = $props()

  const tabs = $derived([
    { id: 'pending', label: 'รอดำเนินการ', count: pendingCount },
    { id: 'with_stock', label: 'มีของ', count: withStockCount },
    { id: 'no_stock', label: 'ไม่มีของ', count: noStockCount },
    { id: 'admin_completed', label: 'เสร็จสิ้น', count: adminCompletedCount },
  ] as const)
</script>

<div class="flex bg-white border-b-2 border-grey-100 overflow-x-auto" role="tablist">
  {#each tabs as tab}
    <button
      role="tab"
      aria-selected={activeTab === tab.id}
      class="flex-1 min-w-0 flex flex-col items-center py-2.5 px-1 text-center border-b-2 transition-colors
        {activeTab === tab.id
          ? 'border-primary-400 text-primary-400'
          : 'border-transparent text-grey-300 hover:text-grey-400'}"
      onclick={() => onTabChange(tab.id)}
    >
      <span class="text-xs font-semibold truncate">{tab.label}</span>
      <span class="text-lg font-bold leading-tight">{tab.count}</span>
    </button>
  {/each}
</div>
