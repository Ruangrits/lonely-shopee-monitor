<script lang="ts">
	import type { ProcessedOrderEntry } from '../data'

	let { order }: { order: ProcessedOrderEntry } = $props()

	const totalQty = $derived(order.items.reduce((sum, item) => sum + item.quantity, 0))
	const isWithStock = $derived(order.localState.state === 'with_stock')
	const reasonLabel = $derived(
		order.localState.reason === 'out_of_stock' ? 'สินค้าหมด' :
		order.localState.reason === 'different_variant' ? 'มีสินค้า (สี/ไซซ์/ขนาด) อื่น' : ''
	)
</script>

<div class="bg-white border border-grey-100 rounded-xl p-3 sm:p-4 shadow-sm opacity-80">
	<div class="flex justify-between items-start gap-2 mb-3">
		<div class="flex items-center gap-1.5 flex-wrap min-w-0">
			<span class="text-primary-400 text-xs font-semibold">#{order.orderId}</span>
			<span class="text-grey-200 text-xs">•</span>
			<span class="text-grey-300 text-xs">👤 {order.buyerName || '-'}</span>
		</div>
		<span class="text-2xs px-2 py-1 rounded-full font-semibold border shrink-0
			{isWithStock
				? 'bg-success-50 text-success-200 border-success-100'
				: 'bg-danger-50 text-danger-200 border-danger-100'}">
			{isWithStock ? 'มีสินค้า' : 'ไม่มีสินค้า'}
		</span>
	</div>

	<div class="flex items-center gap-3 py-2 border-t border-grey-100">
		{#if order.items[0]?.imageUrl}
			<img src={order.items[0].imageUrl} alt="" class="w-12 h-12 object-cover rounded-lg border border-grey-100 shrink-0" />
		{:else}
			<div class="w-12 h-12 bg-grey-50 rounded-lg flex items-center justify-center shrink-0 text-xl">📷</div>
		{/if}
		<div class="flex-1 min-w-0">
			<div class="text-grey-400 text-sm font-medium leading-snug truncate">{order.items[0]?.productName || '-'}</div>
			{#if !isWithStock && reasonLabel}
				<div class="text-danger-200 text-xs mt-0.5">สาเหตุ: {reasonLabel}</div>
			{/if}
		</div>
		<div class="text-grey-400 text-2xl font-extrabold shrink-0">
			{totalQty}<span class="text-grey-300 text-2xs ml-0.5">ชิ้น</span>
		</div>
	</div>

	{#if order.localState.imageUrls.length > 0}
		<div class="pt-2 border-t border-grey-100 mt-1">
			<span class="text-grey-200 text-xs">รูปแนบ: {order.localState.imageUrls.length} ใบ</span>
		</div>
	{/if}
</div>
