<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { shopeeOrderService } from '$lib/core/services/shopee-order-service'
  import { orderProcessingService } from './order-processing.service'
  import type { Order } from '$lib/modules/dashboard/data'
  import type { LocalOrderState } from './data'
  import OrderCard from '$lib/modules/dashboard/components/OrderCard.svelte'
  import ProcessingTabFilter from './components/ProcessingTabFilter.svelte'
  import ProcessOrderDialog from './components/ProcessOrderDialog.svelte'
  import ViewProcessedOrderDialog from './components/ViewProcessedOrderDialog.svelte'

  interface ProcessedEntry { order: Order; localState: LocalOrderState }

  let loggedIn = $state(false)
  let loading = $state(true)
  let initError = $state('')

  let shopeeOrders = $state<Order[]>([])
  let localStates = $state<LocalOrderState[]>([])
  let activeTab = $state<'pending' | 'with_stock' | 'no_stock'>('pending')
  let selectedPending = $state<Order | null>(null)
  let selectedProcessed = $state<ProcessedEntry | null>(null)
  let syncing = $state(false)
  let lastSyncedAt = $state('')
  let syncError = $state('')
  let syncInterval: ReturnType<typeof setInterval> | null = null

  const stateMap = $derived(new Map(localStates.map(s => [s.orderId, s])))

  const pendingOrders = $derived(
    shopeeOrders.filter(o => {
      const ls = stateMap.get(o.orderId)
      return o.status === 'ยังไม่ดำเนินการ' && (!ls || ls.state === 'pending')
    })
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

  async function init() {
    loading = true
    initError = ''
    const either = await shopeeOrderService.getAuthStatus().promise
    if (either.isRight) {
      loggedIn = either.getRight().loggedIn
      if (!loggedIn) {
        initError = 'ยังไม่ได้ login Shopee — กรุณาตรวจสอบ SHOPEE_USERNAME/PASSWORD ใน .env แล้ว restart backend'
      }
    } else {
      initError = 'ไม่สามารถเชื่อมต่อ backend ได้ — กรุณาตรวจสอบว่า backend กำลังทำงานอยู่'
    }
    loading = false
  }

  async function sync() {
    if (syncing) return
    syncing = true
    syncError = ''
    try {
      const [ordersResult, statesResult] = await Promise.all([
        shopeeOrderService.refreshOrders().promise,
        orderProcessingService.getOrderStates().promise,
      ])

      if (ordersResult.isRight) {
        const data = ordersResult.getRight()
        shopeeOrders = (data.accounts ?? []).flatMap(acc =>
          acc.toShipOrders.map(o => ({
            ...o,
            accountName: acc.accountName,
            platform: acc.platform,
          }))
        )
      } else {
        syncError = 'ดึงออเดอร์จาก Shopee ไม่สำเร็จ'
      }

      if (statesResult.isRight) localStates = statesResult.getRight()
      if (ordersResult.isRight || statesResult.isRight) lastSyncedAt = new Date().toISOString()
    } catch {
      syncError = 'เชื่อมต่อ backend ไม่ได้'
    } finally {
      syncing = false
    }
  }

  function handleProcessed(state: LocalOrderState) {
    localStates = [...localStates.filter(s => s.orderId !== state.orderId), state]
    selectedPending = null
  }

  function formatTime(iso: string): string {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    } catch { return '' }
  }

  onMount(async () => {
    await init()
    if (loggedIn) {
      sync()
      syncInterval = setInterval(sync, 5 * 60 * 1000)
    }
  })

  onDestroy(() => {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null }
  })
</script>

{#if loading}
  <div class="flex items-center justify-center min-h-screen">
    <div class="flex flex-col items-center gap-3">
      <div class="w-8 h-8 border-3 border-primary-300 border-t-transparent rounded-full animate-spin"></div>
      <div class="text-sm text-grey-300">กำลังเชื่อมต่อ Shopee...</div>
    </div>
  </div>
{:else if !loggedIn}
  <div class="flex items-center justify-center min-h-screen">
    <div class="max-w-md p-6 bg-white rounded-xl shadow-lg text-center">
      <div class="flex flex-col gap-4">
        <div class="text-lg font-bold text-grey-400">จัดการคำสั่งซื้อ</div>
        <div class="p-3 bg-danger-50 text-danger-200 rounded-lg text-sm">{initError}</div>
        <div class="text-xs text-grey-200">
          ตั้งค่า SHOPEE_USERNAME และ SHOPEE_PASSWORD ในไฟล์ backend/.env แล้ว restart backend
        </div>
      </div>
    </div>
  </div>
{:else}

<div class="min-h-screen bg-grey-50 p-3 sm:p-6">
  <div class="max-w-3xl mx-auto">

    <div class="flex justify-between items-start gap-2 mb-5 sm:mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-grey-400">จัดการคำสั่งซื้อ</h1>
        {#if syncError}
          <div class="text-xs text-danger-200 mt-0.5">{syncError}</div>
        {:else if lastSyncedAt}
          <span class="text-grey-200 text-xs mt-1">อัปเดต: {formatTime(lastSyncedAt)}</span>
        {/if}
      </div>
      <button
        class="bg-primary-400 hover:bg-primary-500 text-white px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
        onclick={sync}
        disabled={syncing}
        aria-label={syncing ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูล'}
        aria-busy={syncing}
      >
        {syncing ? '...' : 'โหลดใหม่'}
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
            {@const ls = stateMap.get(order.orderId)}
            <button
              class="w-full text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-300 rounded-xl flex flex-col gap-1.5"
              onclick={() => selectedPending = order}
              aria-label="กดเพื่อดำเนินการออเดอร์ {order.orderId}"
            >
              <OrderCard {order} />
              {#if ls?.note}
                <div class="w-full bg-white border border-grey-100 rounded-xl px-3 py-2 text-xs flex items-start gap-1.5">
                  <span class="text-grey-200 shrink-0">โน้ต:</span>
                  <span class="text-grey-400">{ls.note}</span>
                </div>
              {/if}
            </button>
          {/each}
        {/if}

      {:else if activeTab === 'with_stock'}
        {#if withStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each withStockOrders as entry (entry.order.orderId)}
            <button
              class="w-full text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-success-100 rounded-xl"
              onclick={() => selectedProcessed = entry}
              aria-label="ดูรายละเอียดออเดอร์ {entry.order.orderId}"
            >
              <OrderCard order={entry.order} />
            </button>
          {/each}
        {/if}

      {:else}
        {#if noStockOrders.length === 0}
          <div class="text-center py-16 text-grey-300">
            <div class="text-4xl mb-3">📦</div>
            <div class="text-sm">ยังไม่มีรายการในหมวดนี้</div>
          </div>
        {:else}
          {#each noStockOrders as entry (entry.order.orderId)}
            <button
              class="w-full text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-danger-100 rounded-xl"
              onclick={() => selectedProcessed = entry}
              aria-label="ดูรายละเอียดออเดอร์ {entry.order.orderId}"
            >
              <OrderCard order={entry.order} />
            </button>
          {/each}
        {/if}
      {/if}
    </div>

  </div>
</div>

{#if selectedPending}
  <ProcessOrderDialog
    order={selectedPending}
    onClose={() => selectedPending = null}
    onProcessed={handleProcessed}
  />
{/if}

{#if selectedProcessed}
  <ViewProcessedOrderDialog
    order={selectedProcessed.order}
    localState={selectedProcessed.localState}
    onClose={() => selectedProcessed = null}
  />
{/if}

{/if}
