import type { OrderGateway } from '../../domain/ports.js'
import type { ScrapeResult, Order, OrderItem, OrderSummary } from '../../domain/entities.js'
import { EMPTY_RESULT, Platform } from '../../domain/entities.js'
import type { ShopeeAuthGateway } from './shopee-auth.gateway.js'

const SELLER_CENTRE_URL = 'https://seller.shopee.co.th'
const ORDER_URL = `${SELLER_CENTRE_URL}/portal/sale/order`
const SHOPEE_IMAGE_CDN = 'https://cf.shopee.co.th/file/'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = { code: number; data: any; message?: string }

export class ShopeeApiGateway implements OrderGateway {
  constructor(
    private auth: ShopeeAuthGateway,
    private accountId: string = '',
    private accountName: string = '',
  ) {}

  private async browserPost(endpoint: string, body: unknown): Promise<ApiResponse> {
    const page = this.auth.getPage()
    if (!page) throw new Error('No browser page available')

    const result = await page.evaluate(
      async ({ endpoint, body }) => {
        const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/)
        const csrfToken = csrfMatch ? csrfMatch[1] : ''
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
          },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        return res.json()
      },
      { endpoint: `${SELLER_CENTRE_URL}${endpoint}`, body },
    )

    return result as ApiResponse
  }

  private parseOrderTime(orderSn: string): string {
    const match = orderSn.match(/^(\d{2})(\d{2})(\d{2})/)
    if (!match) return ''
    const thaiYear = parseInt(match[1]) + 43
    const monthNames = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    return `${parseInt(match[3])} ${monthNames[parseInt(match[2])] || match[2]} ${thaiYear}`
  }

  /** Fetch order indexes for a given toShip status (1=unprocessed, 2=processed) */
  private async getToShipIndexes(orderToShipStatus: number): Promise<Array<Record<string, unknown>>> {
    const data = await this.browserPost('/api/v3/order/search_order_list_index', {
      order_list_tab: 300,
      entity_type: 1,
      pagination: { from_page_number: 1, page_number: 1, page_size: 40 },
      filter: {
        order_to_ship_status: orderToShipStatus,
        fulfillment_type: 0,
        is_drop_off: 0,
        action_filter: 0,
        fulfillment_source: 0,
        // NO shipping_priority → returns ALL priorities (ทั้งหมด)
      },
      sort: { sort_type: 2, ascending: true },
      current_time: Math.floor(Date.now() / 1000),
    })

    if (data.code !== 0) {
      console.warn(`  index API error: code=${data.code} (ots=${orderToShipStatus})`)
      return []
    }

    const list = data.data?.index_list || []
    console.log(`  index (ots=${orderToShipStatus}): ${list.length} items, total=${data.data?.pagination?.total || 0}`)
    return list
  }

  /** Fetch order cards — supports both package_param_list and order_param_list */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getOrderCards(indexes: Array<Record<string, unknown>>): Promise<any[]> {
    if (!indexes.length) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allCards: any[] = []
    const batchSize = 5

    for (let i = 0; i < indexes.length; i += batchSize) {
      const batch = indexes.slice(i, i + batchSize)

      // Detect format: if index has package_number, use package_param_list
      const hasPackage = batch.some(idx => idx.package_number)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: Record<string, any> = {
        order_list_tab: 300,
        need_count_down_desc: true,
      }

      if (hasPackage) {
        body.package_param_list = batch.map(idx => ({
          package_number: idx.package_number,
          shop_id: idx.shop_id,
          region_id: idx.region_id,
        }))
      } else {
        body.order_param_list = batch.map(idx => ({
          order_id: idx.order_id,
          shop_id: idx.shop_id,
          region_id: idx.region_id,
        }))
      }

      try {
        const data = await this.browserPost('/api/v3/order/get_order_list_card_list', body)
        if (data.code === 0 && data.data?.card_list) {
          allCards.push(...data.data.card_list)
        }
      } catch (err) {
        console.error(`  card batch failed:`, err instanceof Error ? err.message : err)
      }
    }

    return allCards
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCards(cardList: any[]): Order[] {
    const orders: Order[] = []

    for (const rawCard of cardList) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = (rawCard as any).order_card || (rawCard as any).package_level_order_card || (rawCard as any).package_card
      if (!card) {
        console.log(`  unknown card format, keys:`, Object.keys(rawCard))
        continue
      }

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

      orders.push({ orderId, buyerName, orderTime: this.parseOrderTime(orderId), items, status: cardStatus })
    }

    return orders
  }

  private async getToShipMeta(): Promise<OrderSummary> {
    try {
      const data = await this.browserPost('/api/v3/order/get_order_list_to_ship_meta', {
        entity_type: 1,
        order_status: 0,
        shipping_priority: 0,
      })

      if (data.code === 0 && data.data) {
        const raw = data.data
        const entityType = raw.entity_type || {}
        const orderStatus = raw.order_status || {}

        const toShip = entityType['1'] || 0
        const unprocessed = orderStatus['1'] || 0
        const processed = orderStatus['2'] || 0

        console.log(`  meta: toShip=${toShip}, unprocessed=${unprocessed}, processed=${processed}`)
        return { toShip, toShipUnprocessed: unprocessed, toShipProcessed: processed }
      }
    } catch (err) {
      console.log('  meta failed:', err instanceof Error ? err.message : err)
    }
    return { toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0 }
  }

  async fetchAll(): Promise<ScrapeResult> {
    const page = this.auth.getPage()
    if (!page) {
      console.log('No browser page — cannot fetch')
      return EMPTY_RESULT
    }

    console.log('Fetching orders...')

    // Ensure browser is on seller centre
    try {
      if (!page.url().includes(SELLER_CENTRE_URL)) {
        await page.goto(ORDER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
        await page.waitForTimeout(2000)
      }
    } catch { /* ignore */ }

    // 1) Get meta counts
    const meta = await this.getToShipMeta()

    // 2) Get order indexes (all shipping priorities)
    const [unprocessedIdx, processedIdx] = await Promise.all([
      this.getToShipIndexes(1),
      this.getToShipIndexes(2),
    ])

    // 3) Get card details
    const [unprocessedCards, processedCards] = await Promise.all([
      this.getOrderCards(unprocessedIdx),
      this.getOrderCards(processedIdx),
    ])

    // 4) Parse into orders
    const unprocessedOrders = this.parseCards(unprocessedCards)
    const processedOrders = this.parseCards(processedCards)

    for (const o of unprocessedOrders) o.status = 'ยังไม่ดำเนินการ'
    for (const o of processedOrders) o.status = 'ดำเนินการแล้ว'

    const toShipOrders = [...unprocessedOrders, ...processedOrders]

    // Use actual count if meta is off
    const summary: OrderSummary = {
      toShip: meta.toShip || toShipOrders.length,
      toShipUnprocessed: meta.toShipUnprocessed || unprocessedOrders.length,
      toShipProcessed: meta.toShipProcessed || processedOrders.length,
    }

    console.log(`Result: ${toShipOrders.length} orders (unprocessed=${unprocessedOrders.length}, processed=${processedOrders.length})`)

    return {
      accountId: this.accountId,
      accountName: this.accountName,
      platform: Platform.Shopee,
      summary,
      toShipOrders,
    }
  }
}
