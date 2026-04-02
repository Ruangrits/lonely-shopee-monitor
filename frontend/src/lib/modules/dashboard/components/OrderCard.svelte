<script lang="ts">
	import type { Order } from '../data'

	let { order }: { order: Order } = $props()

	const totalQty = $derived(order.items.reduce((sum, item) => sum + item.quantity, 0))

	const statusStyle = $derived(
		order.status === 'ดำเนินการแล้ว'
			? 'bg-success-50 text-success-200 border-success-100'
			: 'bg-primary-50 text-primary-500 border-primary-100'
	)
</script>

<div class="bg-white border border-grey-100 rounded-xl p-4 shadow-sm">
	<!-- Header -->
	<div class="flex justify-between items-center mb-3">
		<div class="flex items-center gap-2">
			{#if order.accountName}
				<span class="text-secondary-300 text-2xs font-semibold bg-secondary-50 px-2 py-0.5 rounded">{order.accountName}</span>
			{/if}
			<span class="text-primary-400 text-xs font-semibold">#{order.orderId}</span>
			<span class="text-grey-200 text-xs">•</span>
			<span class="text-grey-300 text-xs">👤 {order.buyerName || '-'}</span>
		</div>
		<span class="text-2xs px-3 py-1 rounded-full font-semibold border {statusStyle}">
			{order.status}
		</span>
	</div>

	<!-- Items -->
	{#each order.items as item}
		<div class="flex items-center gap-3.5 py-3 border-t border-grey-100">
			{#if item.imageUrl}
				<img
					src={item.imageUrl}
					alt={item.productName}
					class="w-16 h-16 object-cover rounded-lg border border-primary-100 shrink-0"
				/>
			{:else}
				<div class="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center shrink-0 border border-primary-100 text-2xl">
					📷
				</div>
			{/if}

			<div class="flex-1 min-w-0">
				<div class="text-grey-400 text-sm font-medium leading-snug">{item.productName}</div>
				{#if item.variant}
					<div class="text-grey-300 text-xs mt-1">
						ตัวเลือก: <span class="text-primary-300 font-medium">{item.variant}</span>
					</div>
				{/if}
			</div>

			<div class="text-center shrink-0 px-4">
				<div class="text-primary-400 text-3xl font-extrabold leading-none">{item.quantity}</div>
				<div class="text-grey-300 text-2xs mt-0.5">ชิ้น</div>
			</div>
		</div>
	{/each}

	<!-- Footer -->
	<div class="flex justify-between items-center pt-2.5 border-t border-grey-100 mt-1">
		<div class="flex items-center gap-1 text-grey-200 text-xs">
			<svg class="w-3.5 h-3.5 text-grey-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
			</svg>
			<span>{order.orderTime || '-'}</span>
		</div>
		<div class="text-primary-300 text-xs font-semibold">รวม {totalQty} ชิ้น</div>
	</div>
</div>
