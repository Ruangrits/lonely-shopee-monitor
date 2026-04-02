<script lang="ts">
	import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
	import type { OrderSummary, Order } from './data'
	import TabFilter from './components/TabFilter.svelte'
	import OrderCard from './components/OrderCard.svelte'
	import LoginStatus from './components/LoginStatus.svelte'
	import { onMount } from 'svelte'

	let {
		loggedIn = false
	}: {
		loggedIn?: boolean
	} = $props()

	let summary = $state<OrderSummary>({ unpaid: 0, toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0, shipping: 0, completed: 0, cancelled: 0 })
	let toShipOrders = $state<Order[]>([])
	let lastScrapedAt = $state('')
	let activeTab = $state('unprocessed')
	let refreshing = $state(false)

	// Filter orders ตาม active tab
	const filteredOrders = $derived.by(() => {
		if (activeTab === 'all') return toShipOrders
		if (activeTab === 'unprocessed') return toShipOrders.filter((o) => o.status === 'ยังไม่ดำเนินการ')
		if (activeTab === 'processed') return toShipOrders.filter((o) => o.status === 'ดำเนินการแล้ว')
		return toShipOrders
	})

	async function loadData() {
		const either = await shopeeOrderService.getSummary().promise
		if (either.isRight) {
			const data = either.getRight()
			summary = data.summary
			toShipOrders = data.toShipOrders || []
			if (data.scrapedAt) lastScrapedAt = data.scrapedAt
		}
	}

	async function handleRefresh() {
		refreshing = true
		const either = await shopeeOrderService.refreshOrders().promise
		if (either.isRight) {
			const data = either.getRight()
			summary = data.summary
			toShipOrders = data.toShipOrders || []
			lastScrapedAt = data.scrapedAt
		}
		refreshing = false
	}

	function formatTime(iso: string): string {
		if (!iso) return ''
		try {
			return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
		} catch {
			return ''
		}
	}

	onMount(() => {
		loadData()
		const id = setInterval(loadData, 60_000)
		return () => clearInterval(id)
	})
</script>

<div class="min-h-screen bg-grey-50 p-6">
	<div class="max-w-3xl mx-auto">

		<!-- Header -->
		<div class="flex justify-between items-center mb-6">
			<div>
				<h1 class="text-2xl font-bold text-grey-400">คำสั่งซื้อที่รอจัดส่ง</h1>
				<div class="flex items-center gap-3 mt-1">
					<LoginStatus {loggedIn} />
					{#if lastScrapedAt}
						<span class="text-grey-200 text-xs">อัปเดต: {formatTime(lastScrapedAt)}</span>
					{/if}
				</div>
			</div>
			<button
				class="bg-primary-400 hover:bg-primary-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
				onclick={handleRefresh}
				disabled={refreshing}
			>
				{refreshing ? '...' : '🔄 Refresh'}
			</button>
		</div>

		<!-- Tab Filter -->
		<div class="mb-6">
			<TabFilter
				toShipCount={summary.toShip}
				unprocessedCount={summary.toShipUnprocessed}
				processedCount={summary.toShipProcessed}
				{activeTab}
				onTabChange={(tab) => activeTab = tab}
			/>
		</div>

		<!-- Order List -->
		<div class="flex flex-col gap-3">
			{#if filteredOrders.length === 0}
				<div class="text-center py-16 text-grey-300">
					<div class="text-4xl mb-3">📦</div>
					<div class="text-sm">ไม่มีคำสั่งซื้อในหมวดนี้</div>
				</div>
			{:else}
				{#each filteredOrders as order (order.orderId)}
					<OrderCard {order} />
				{/each}
			{/if}
		</div>

	</div>
</div>
