<script lang="ts">
	import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
	import type { OrderSummary, Order, AccountResult } from './data'
	import TabFilter from './components/TabFilter.svelte'
	import OrderCard from './components/OrderCard.svelte'
	import { onMount } from 'svelte'

	let summary = $state<OrderSummary>({ toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0 })
	let toShipOrders = $state<Order[]>([])
	let lastScrapedAt = $state('')
	let activeTab = $state('unprocessed')
	let refreshing = $state(false)

	const filteredOrders = $derived.by(() => {
		if (activeTab === 'all') return toShipOrders
		if (activeTab === 'unprocessed') return toShipOrders.filter((o) => o.status === 'ยังไม่ดำเนินการ')
		if (activeTab === 'processed') return toShipOrders.filter((o) => o.status === 'ดำเนินการแล้ว')
		return toShipOrders
	})

	function mergeAccounts(accounts: AccountResult[]) {
		const merged: OrderSummary = { toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0 }
		const allOrders: Order[] = []

		for (const acc of accounts) {
			merged.toShip += acc.summary.toShip
			merged.toShipUnprocessed += acc.summary.toShipUnprocessed
			merged.toShipProcessed += acc.summary.toShipProcessed

			for (const order of acc.toShipOrders) {
				allOrders.push({ ...order, accountName: acc.accountName, platform: acc.platform })
			}
		}

		summary = merged
		toShipOrders = allOrders
		if (accounts.length > 0 && accounts[0].scrapedAt) {
			lastScrapedAt = accounts[0].scrapedAt
		}
	}

	async function loadData() {
		const either = await shopeeOrderService.getSummary().promise
		if (either.isRight) {
			const data = either.getRight()
			mergeAccounts(data.accounts || [])
		}
	}

	async function handleRefresh() {
		refreshing = true
		const either = await shopeeOrderService.refreshOrders().promise
		if (either.isRight) {
			const data = either.getRight()
			mergeAccounts(data.accounts || [])
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
		handleRefresh()
	})
</script>

<div class="min-h-screen bg-grey-50 p-3 sm:p-6">
	<div class="max-w-3xl mx-auto">

		<!-- Header -->
		<div class="flex justify-between items-start gap-2 mb-5 sm:mb-6">
			<div>
				<h1 class="text-xl sm:text-2xl font-bold text-grey-400">คำสั่งซื้อที่รอจัดส่ง</h1>
				{#if lastScrapedAt}
					<span class="text-grey-200 text-xs mt-1">อัปเดต: {formatTime(lastScrapedAt)}</span>
				{/if}
			</div>
			<button
				class="bg-primary-400 hover:bg-primary-500 text-white px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
				onclick={handleRefresh}
				disabled={refreshing}
			>
				{refreshing ? '...' : 'Refresh'}
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
