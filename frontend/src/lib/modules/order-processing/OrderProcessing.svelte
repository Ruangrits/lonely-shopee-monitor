<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
  import { orderProcessingService } from './order-processing.service'
  import type { ProcessingOrder, LocalOrderState, ProcessedOrderEntry } from './data'
  import ProcessingTabFilter from './components/ProcessingTabFilter.svelte'
  import PendingOrderCard from './components/PendingOrderCard.svelte'
  import ProcessedOrderCard from './components/ProcessedOrderCard.svelte'
  import ProcessOrderDialog from './components/ProcessOrderDialog.svelte'

  let shopeeOrders = $state<ProcessingOrder[]>([])
  let localStates = $state<LocalOrderState[]>([])
  let activeTab = $state<'pending' | 'with_stock' | 'no_stock'>('pending')
  let selectedOrder = $state<ProcessingOrder | null>(null)
  let syncing = $state(false)
  let lastSyncedAt = $state('')
  let syncInterval: ReturnType<typeof setInterval> | null = null

  const stateMap = $derived(new Map(localStates.map(s => [s.orderId, s])))

  const pendingOrders = $derived(
    shopeeOrders.filter(o => o.status === 'ยังไม่ดำเนินการ' && !stateMap.has(o.orderId))
  )

  const withStockOrders = $derived(
    shopeeOrders
      .filter(o => stateMap.get(o.orderId)?.state === 'with_stock')
      .map(o => ({ ...o, localState: stateMap.get(o.orderId)! }) as ProcessedOrderEntry)
  )

  const noStockOrders = $derived(
    shopeeOrders
      .filter(o => stateMap.get(o.orderId)?.state === 'no_stock')
      .map(o => ({ ...o, localState: stateMap.get(o.orderId)! }) as ProcessedOrderEntry)
  )

  async function sync() {
    syncing = true
    const [ordersResult, statesResult] = await Promise.all([
      shopeeOrderService.getSummary().promise,
      orderProcessingService.getOrderStates().promise,
    ])

    if (ordersResult.isRight) {
      const data = ordersResult.getRight()
      shopeeOrders = (data.accounts ?? []).flatMap(acc =>
        acc.toShipOrders.map(o => ({
          ...o,
          accountName: acc.accountName,
          platform: acc.platform as string,
        }))
      )
    }

    if (statesResult.isRight) {
      localStates = statesResult.getRight()
    }

    lastSyncedAt = new Date().toISOString()
    syncing = false
  }

  function handleProcessed(state: LocalOrderState) {
    localStates = [...localStates.filter(s => s.orderId !== state.orderId), state]
    selectedOrder = null
  }

  function formatTime(iso: string): string {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  onMount(() => {
    sync()
    syncInterval = setInterval(sync, 5 * 60 * 1000)
  })

  onDestroy(() => {
    if (syncInterval) clearInterval(syncInterval)
  })
</script>

<div class="min-h-screen bg-grey-50 p-3 sm:p-6">
  <div class="max-w-3xl mx-auto">

    <div class="flex justify-between items-start gap-2 mb-5 sm:mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-grey-400">จัดการคำสั่งซื้อ</h1>
        {#if lastSyncedAt}
          <span class="text-grey-200 text-xs mt-1">อัปเดต: {formatTime(lastSyncedAt)}</span>
        {/if}
      </div>
      <button
        class="bg-primary-400 hover:bg-primary-500 text-white px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        onclick={sync}
        disabled={syncing}
      >
        {syncing ? '...' : 'Sync'}
      </button>
    </div>

    <div class="mb-6">
      <ProcessingTabFilter
        pendingCount={pendingOrders.length}
        withStockCount={withStockOrders.length}
        noStockCount={noStockOrders.length}
        {activeTab}
        onTabChange={(tab) => activeTab = tab as typeof activeTab}
      />
    </div>

    <div class="flex flex-col gap-3">
      {#if activeTab === 'pending'}
        {#if pendingOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">✅</div>
            <div class="text-sm">ไม่มีคำสั่งซื้อที่รอดำเนินการ</div>
          </div>
        {:else}
          {#each pendingOrders as order (order.orderId)}
            <PendingOrderCard {order} onClick={() => selectedOrder = order} />
          {/each}
        {/if}

      {:else if activeTab === 'with_stock'}
        {#if withStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each withStockOrders as order (order.orderId)}
            <ProcessedOrderCard {order} />
          {/each}
        {/if}

      {:else}
        {#if noStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each noStockOrders as order (order.orderId)}
            <ProcessedOrderCard {order} />
          {/each}
        {/if}
      {/if}
    </div>

  </div>
</div>

{#if selectedOrder}
  <ProcessOrderDialog
    order={selectedOrder}
    onClose={() => selectedOrder = null}
    onProcessed={handleProcessed}
  />
{/if}
