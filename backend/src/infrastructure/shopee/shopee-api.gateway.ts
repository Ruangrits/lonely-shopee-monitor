import type { OrderGateway } from '../../domain/ports.js'
import type { ScrapeResult, Order, OrderItem, OrderSummary } from '../../domain/entities.js'
import { EMPTY_RESULT, Platform } from '../../domain/entities.js'
import type { ShopeeAuthGateway } from './shopee-auth.gateway.js'

const SELLER_CENTRE_URL = 'https://seller.shopee.co.th'
const ORDER_URL = `${SELLER_CENTRE_URL}/portal/sale`
const SHOPEE_IMAGE_CDN = 'https://cf.shopee.co.th/file/'

export class ShopeeApiGateway implements OrderGateway {
  constructor(
    private auth: ShopeeAuthGateway,
    private accountId: string = '',
    private accountName: string = '',
  ) {}

  /** Make API call through browser context to bypass anti-bot checks */
  private async browserPost(endpoint: string, body: unknown): Promise<unknown> {
    const page = this.auth.getPage()
    if (!page) throw new Error('No browser page available')

    return page.evaluate(
      async ({ endpoint, body }) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return res.json()
      },
      { endpoint: `${SELLER_CENTRE_URL}${endpoint}`, body },
    )
  }

  private async getOrderIndexes(tab: number): Promise<Array<{ order_id: number; shop_id: number; region_id: string }>> {
    const data = await this.browserPost('/api/v3/order/search_order_list_index', {
      order_list_tab: tab,
      entity_type: 1,
      pagination: { from_page_number: 1, page_number: 1, page_size: 40 },
      filter: { fulfillment_type: 0, is_drop_off: 0, fulfillment_source: 0, action_filter: 0 },
      sort: { sort_type: 3, ascending: false },
    }) as { code: number; data: { index_list: Array<{ order_id: number; shop_id: number; region_id: string }> } }

    if (data.code !== 0) {
      console.warn(`Order index API error: code=${data.code} (tab=${tab})`)
      this.auth.markSessionExpired()
      return []
    }
    return data.data.index_list
  }

  private parseOrderTime(orderSn: string): string {
    const match = orderSn.match(/^(\d{2})(\d{2})(\d{2})/)
    if (!match) return ''
    const thaiYear = parseInt(match[1]) + 43
    const monthNames = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = parseInt(match[2])
    const day = parseInt(match[3])
    return `${day} ${monthNames[month] || match[2]} ${thaiYear}`
  }

  private async getOrderCards(tab: number, orderParams: Array<{ order_id: number; shop_id: number; region_id: string }>): Promise<Order[]> {
    if (orderParams.length === 0) return []

    const orders: Order[] = []
    const batchSize = 5

    for (let i = 0; i < orderParams.length; i += batchSize) {
      const batch = orderParams.slice(i, i + batchSize)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = await this.browserPost('/api/v3/order/get_order_list_card_list', {
          order_list_tab: tab,
          need_count_down_desc: true,
          order_param_list: batch,
        }) as { code: number; data: { card_list: Array<Record<string, unknown>> } }

        if (data.code !== 0) continue

        for (const rawCard of data.data.card_list) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const card = (rawCard as any).order_card || (rawCard as any).package_level_order_card
          if (!card) continue

          const orderId: string = card.card_header?.order_sn || ''
          const buyerName: string = card.card_header?.buyer_info?.username || ''
          const cardStatus: string = card.status_info?.status || ''

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let itemInfoLists: any[] = []
          if (card.item_info_group?.item_info_list) {
            itemInfoLists = card.item_info_group.item_info_list
          } else if (card.package_list) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const pkg of card.package_list as any[]) {
              if (pkg.item_info_group?.item_info_list) {
                itemInfoLists.push(...pkg.item_info_group.item_info_list)
              }
            }
          }

          const items: OrderItem[] = []
          for (const group of itemInfoLists) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const item of (group.item_list || []) as any[]) {
              const variantMatch = item.description?.match(/ตัวเลือกสินค้า:\s*(.+?)(?:\s*$)/)
              items.push({
                productName: item.name || '',
                variant: variantMatch ? variantMatch[1].trim() : '',
                quantity: item.amount || 1,
                imageUrl: item.image ? `${SHOPEE_IMAGE_CDN}${item.image}` : '',
              })
            }
          }

          orders.push({
            orderId,
            buyerName,
            orderTime: this.parseOrderTime(orderId),
            items,
            status: cardStatus,
          })
        }
      } catch (err) {
        console.error(`  Batch failed:`, err instanceof Error ? err.message : err)
      }
    }

    return orders
  }

  private async getTabMeta(): Promise<OrderSummary> {
    try {
      const data = await this.browserPost('/api/v3/order/get_order_list_meta_v2', {}) as {
        code: number
        data: {
          OrderListTabMeta: Array<{
            to_ship_tab_meta?: { l1_meta: number; l2_meta_list?: Array<{ status: number; count: number }> }
            shipping_tab_meta?: { l1_meta: number }
            completed_tab_meta?: { l1_meta: number }
            cancellation_tab_meta?: { l1_meta: number }
            unpaid_tab_meta?: { l1_meta: number }
          }>
        }
      }

      if (data.code === 0 && data.data.OrderListTabMeta?.[0]) {
        const meta = data.data.OrderListTabMeta[0]
        const toShipMeta = meta.to_ship_tab_meta
        // l2_meta_list: status=1 → unprocessed, status=2 → processed
        const unprocessed = toShipMeta?.l2_meta_list?.find(m => m.status === 1)?.count || 0
        const processed = toShipMeta?.l2_meta_list?.find(m => m.status === 2)?.count || 0
        return {
          unpaid: meta.unpaid_tab_meta?.l1_meta || 0,
          toShip: toShipMeta?.l1_meta || 0,
          toShipUnprocessed: unprocessed,
          toShipProcessed: processed,
          shipping: meta.shipping_tab_meta?.l1_meta || 0,
          completed: meta.completed_tab_meta?.l1_meta || 0,
          cancelled: meta.cancellation_tab_meta?.l1_meta || 0,
        }
      }
    } catch (err) {
      console.log('Tab meta API failed:', err instanceof Error ? err.message : err)
    }
    return { unpaid: 0, toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0, shipping: 0, completed: 0, cancelled: 0 }
  }

  async fetchAll(): Promise<ScrapeResult> {
    if (!this.auth.getPage()) {
      console.log('No browser page — cannot fetch')
      return EMPTY_RESULT
    }

    console.log('Fetching orders via browser API...')

    // Navigate to order page first to ensure correct context
    const page = this.auth.getPage()!
    try {
      const currentUrl = page.url()
      if (!currentUrl.includes('seller.shopee.co.th')) {
        await page.goto(ORDER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000)
      }
    } catch { /* ignore nav errors */ }

    const tabMeta = await this.getTabMeta()

    const [toShipIndexes, shippingIndexes] = await Promise.all([
      this.getOrderIndexes(300),
      this.getOrderIndexes(400),
    ])
    console.log(`Indexes: toShip=${toShipIndexes.length}, shipping=${shippingIndexes.length}`)

    const [toShipOrders, shippingOrders] = await Promise.all([
      this.getOrderCards(300, toShipIndexes),
      this.getOrderCards(400, shippingIndexes),
    ])

    // Use tab meta for unprocessed/processed counts (more reliable than card status)
    for (const order of toShipOrders) {
      if (!order.status || order.status === 'ที่ต้องจัดส่ง') {
        order.status = 'ยังไม่ดำเนินการ'
      }
    }

    console.log(`Orders: toShip=${toShipOrders.length} (meta: unprocessed=${tabMeta.toShipUnprocessed}, processed=${tabMeta.toShipProcessed}), shipping=${shippingOrders.length}`)

    return {
      accountId: this.accountId,
      accountName: this.accountName,
      platform: Platform.Shopee,
      summary: {
        unpaid: tabMeta.unpaid,
        toShip: tabMeta.toShip || toShipOrders.length,
        toShipUnprocessed: tabMeta.toShipUnprocessed,
        toShipProcessed: tabMeta.toShipProcessed,
        shipping: tabMeta.shipping || shippingOrders.length,
        completed: tabMeta.completed,
        cancelled: tabMeta.cancelled,
      },
      toShipOrders,
      shippingOrders,
    }
  }
}
