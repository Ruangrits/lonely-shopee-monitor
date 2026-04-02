<script lang="ts">
	let {
		toShipCount = 0,
		unprocessedCount = 0,
		processedCount = 0,
		activeTab = 'unprocessed',
		onTabChange
	}: {
		toShipCount?: number
		unprocessedCount?: number
		processedCount?: number
		activeTab?: string
		onTabChange?: (tab: string) => void
	} = $props()

	const tabs = $derived([
		{ id: 'all', label: 'ที่ต้องจัดส่ง', count: toShipCount },
		{ id: 'unprocessed', label: 'ยังไม่ดำเนินการ', count: unprocessedCount },
		{ id: 'processed', label: 'ดำเนินการแล้ว', count: processedCount }
	])
</script>

<div class="flex bg-white rounded-xl border border-grey-100 overflow-hidden shadow-sm">
	{#each tabs as tab}
		<button
			class="flex-1 text-center py-4 px-5 cursor-pointer border-b-3 transition-all
				{activeTab === tab.id
					? 'bg-primary-50 border-b-primary-400'
					: 'border-b-transparent hover:bg-grey-50'}"
			onclick={() => onTabChange?.(tab.id)}
		>
			<div class="text-xs font-medium {activeTab === tab.id ? 'text-primary-400' : 'text-grey-300'}">
				{tab.label}
			</div>
			<div class="text-3xl font-bold mt-1 {activeTab === tab.id ? 'text-primary-500' : 'text-grey-400'}">
				{tab.count}
			</div>
		</button>
	{/each}
</div>
