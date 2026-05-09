<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
  import { orderProcessingService } from '$lib/modules/order-processing/order-processing.service'
  import { adminService } from './admin.service'
  import type { Order } from '$lib/modules/dashboard/data'
  import type { LocalOrderState } from '$lib/modules/order-processing/data'
  import OrderCard from '$lib/modules/dashboard/components/OrderCard.svelte'
  import AdminTabFilter from './components/AdminTabFilter.svelte'
  import AdminActionSheet from './components/AdminActionSheet.svelte'

  interface OrderEntry { order: Order; localState: LocalOrderState | null }

  let shopeeOrders = $state<Order[]>([])
  let localStates = $state<LocalOrderState[]>([])
  let activeTab = $state<'pending' | 'with_stock' | 'no_stock' | 'admin_completed'>('pending')
  let selectedEntry = $state<OrderEntry | null>(null)
  let syncing = $state(false)
  let cleaning = $state(false)
  let lastSyncedAt = $state('')
  let syncError = $state('')
  let toastMsg = $state('')
  let toastTimer: ReturnType<typeof setTimeout> | null = null
  let syncInterval: ReturnType<typeof setInterval> | null = null

  const stateMap = $derived(new Map(localStates.map(s => [s.orderId, s])))

  const pendingOrders = $derived(
    shopeeOrders
      .filter(o => !stateMap.has(o.orderId))
      .map(o => ({ order: o, localState: null }) satisfies OrderEntry)
  )

  const withStockOrders = $derived(
    shopeeOrders.flatMap(o => {
      const ls = stateMap.get(o.orderId)
      return ls?.state === 'with_stock' ? [{ order: { ...o, status: 'มีของ' }, localState: ls }] : []
    })
  )

  const noStockOrders = $derived(
    shopeeOrders.flatMap(o => {
      const ls = stateMap.get(o.orderId)
      return ls?.state === 'no_stock' ? [{ order: { ...o, status: 'ไม่มีของ' }, localState: ls }] : []
    })
  )

  const adminCompletedOrders = $derived(
    localStates
      .filter(ls => ls.state === 'admin_completed')
      .map(ls => {
        const found = shopeeOrders.find(o => o.orderId === ls.orderId)
        const order: Order = found
          ? { ...found, status: 'เสร็จสิ้น' }
          : { orderId: ls.orderId, buyerName: '', orderTime: ls.processedAt, items: [], status: 'เสร็จสิ้น' }
        return { order, localState: ls }
      })
  )

  const displayedOrders = $derived(
    activeTab === 'pending' ? pendingOrders
    : activeTab === 'with_stock' ? withStockOrders
    : activeTab === 'no_stock' ? noStockOrders
    : adminCompletedOrders
  )

  function showToast(msg: string) {
    toastMsg = msg
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
    toastTimer = setTimeout(() => { toastMsg = '' }, 3000)
  }

  async function sync() {
    if (syncing) return
    syncing = true
    syncError = ''
    try {
      console.log('[Admin] sync: calling refreshOrders() → POST /api/orders/refresh')
      // Refresh orders from Shopee (Playwright — may take 10–30s)
      const refreshPromise = shopeeOrderService.refreshOrders().promise
      // Load local order states in parallel (fast)
      const statesPromise = orderProcessingService.getOrderStates().promise

      const [ordersResult, statesResult] = await Promise.all([refreshPromise, statesPromise])

      if (ordersResult.isRight) {
        const data = ordersResult.getRight()
        shopeeOrders = (data.accounts ?? []).flatMap(acc =>
          acc.toShipOrders.map(o => ({ ...o, accountName: acc.accountName, platform: acc.platform }))
        )
        console.log('[Admin] refreshOrders OK — orders:', shopeeOrders.length)
      } else {
        console.warn('[Admin] refreshOrders failed (Left)', ordersResult)
        syncError = 'ดึงออเดอร์จาก Shopee ไม่สำเร็จ'
      }
      if (statesResult.isRight) localStates = statesResult.getRight()
      if (ordersResult.isRight || statesResult.isRight) lastSyncedAt = new Date().toISOString()
    } catch (e) {
      console.error('[Admin] sync threw:', e)
      syncError = 'เชื่อมต่อ backend ไม่ได้'
    } finally {
      syncing = false
    }
  }

  async function runCleanup() {
    if (syncing || cleaning) return
    cleaning = true
    try {
      const result = await adminService.cleanup().promise
      if (result.isRight) {
        const { deleted } = result.getRight()
        showToast(`ลบ ${deleted} รายการเก่าแล้ว`)
        if (deleted > 0) {
          const statesResult = await orderProcessingService.getOrderStates().promise
          if (statesResult.isRight) localStates = statesResult.getRight()
        }
      }
    } finally {
      cleaning = false
    }
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
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null }
  })
</script>

<div class="min-h-screen bg-grey-50">

  <!-- Sticky header -->
  <div class="bg-white border-b border-grey-100 px-4 py-3 flex justify-between items-center gap-2 sticky top-0 z-10">
    <div>
      <h1 class="text-base font-bold text-grey-400">Admin จัดการออเดอร์</h1>
      {#if syncError}
        <div class="text-xs text-danger-200 mt-0.5">{syncError}</div>
      {:else if lastSyncedAt}
        <div class="text-xs text-grey-200 mt-0.5">อัปเดต: {formatTime(lastSyncedAt)}</div>
      {/if}
    </div>
    <div class="flex gap-2 shrink-0">
      <button
        class="px-3 py-1.5 text-xs font-semibold text-grey-300 border border-grey-200 rounded-lg hover:bg-grey-50 transition-colors disabled:opacity-50"
        onclick={runCleanup}
        disabled={cleaning}
        aria-label={cleaning ? 'กำลังลบ...' : 'ลบประวัติเก่า'}
      >
        {cleaning ? '...' : 'ลบประวัติเก่า'}
      </button>
      <button
        class="px-3 py-1.5 bg-primary-400 hover:bg-primary-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
        onclick={sync}
        disabled={syncing}
        aria-label={syncing ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูล'}
        aria-busy={syncing}
      >
        {syncing ? '...' : 'Sync'}
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <AdminTabFilter
    {activeTab}
    pendingCount={pendingOrders.length}
    withStockCount={withStockOrders.length}
    noStockCount={noStockOrders.length}
    adminCompletedCount={adminCompletedOrders.length}
    onTabChange={(tab) => activeTab = tab}
  />

  <!-- Card list -->
  <div class="p-3 flex flex-col gap-3 max-w-3xl mx-auto">
    {#if displayedOrders.length === 0}
      <div class="text-center py-16 text-grey-300">
        <div class="text-4xl mb-3">📋</div>
        <div class="text-sm">ไม่มีรายการ</div>
      </div>
    {:else}
      {#each displayedOrders as entry (entry.order.orderId)}
        <button
          class="w-full text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-300 rounded-xl"
          onclick={() => selectedEntry = entry}
          aria-label="จัดการออเดอร์ {entry.order.orderId}"
        >
          <OrderCard order={entry.order} />
        </button>
      {/each}
    {/if}
  </div>

</div>

<!-- Toast notification -->
{#if toastMsg}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-grey-400 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-50 whitespace-nowrap">
    {toastMsg}
  </div>
{/if}

<!-- Action Sheet -->
{#if selectedEntry}
  <AdminActionSheet
    order={selectedEntry.order}
    localState={selectedEntry.localState}
    onClose={() => selectedEntry = null}
    onUpdated={() => { selectedEntry = null; sync() }}
  />
{/if}
