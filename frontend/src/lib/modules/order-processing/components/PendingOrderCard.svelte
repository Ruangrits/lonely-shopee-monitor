<script lang="ts">
	import type { ProcessingOrder } from '../data'

	let { order, onClick }: { order: ProcessingOrder; onClick: () => void } = $props()

	const totalQty = $derived(order.items.reduce((sum, item) => sum + item.quantity, 0))
</script>

<button
	class="w-full text-left bg-white border border-grey-100 rounded-xl p-3 sm:p-4 shadow-sm hover:border-primary-200 hover:shadow-md transition-all"
	onclick={onClick}
>
	<div class="flex justify-between items-start gap-2 mb-3">
		<div class="flex items-center gap-1.5 flex-wrap min-w-0">
			<span class="text-primary-400 text-xs font-semibold">#{order.orderId}</span>
			<span class="text-grey-200 text-xs">•</span>
			<span class="text-grey-300 text-xs">👤 {order.buyerName || '-'}</span>
			{#if order.accountName}
				<span class="text-grey-200 text-xs">•</span>
				<span class="text-grey-400 text-2xs font-semibold">{order.accountName}</span>
			{/if}
		</div>
		<span class="text-2xs px-2 py-1 rounded-full font-semibold border shrink-0 bg-primary-50 text-primary-500 border-primary-100">
			รอดำเนินการ
		</span>
	</div>

	<div class="flex items-center gap-3 py-2 border-t border-grey-100">
		{#if order.items[0]?.imageUrl}
			<img src={order.items[0].imageUrl} alt="" class="w-12 h-12 object-cover rounded-lg border border-primary-100 shrink-0" />
		{:else}
			<div class="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center shrink-0 text-xl">📷</div>
		{/if}
		<div class="flex-1 min-w-0">
			<div class="text-grey-400 text-sm font-medium leading-snug truncate">{order.items[0]?.productName || '-'}</div>
			{#if order.items.length > 1}
				<div class="text-grey-300 text-xs mt-0.5">+{order.items.length - 1} รายการ</div>
			{/if}
		</div>
		<div class="text-primary-400 text-2xl font-extrabold shrink-0">
			{totalQty}<span class="text-grey-300 text-2xs ml-0.5">ชิ้น</span>
		</div>
	</div>

	<div class="flex justify-between items-center pt-2 border-t border-grey-100 mt-1">
		<span class="text-grey-200 text-xs">{order.orderTime || '-'}</span>
		<span class="text-primary-400 text-xs font-semibold">กดเพื่อดำเนินการ →</span>
	</div>
</button>
