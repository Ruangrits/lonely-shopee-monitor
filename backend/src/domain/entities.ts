export interface OrderItem {
  productName: string
  variant: string
  quantity: number
  imageUrl: string
}

export interface Order {
  orderId: string
  buyerName: string
  orderTime: string
  items: OrderItem[]
  status: string
}

export interface OrderSummary {
  unpaid: number
  toShip: number
  toShipUnprocessed: number
  toShipProcessed: number
  shipping: number
  completed: number
  cancelled: number
}

export interface ScrapeResult {
  summary: OrderSummary
  toShipOrders: Order[]
  shippingOrders: Order[]
}

export enum Platform {
  Shopee = 'shopee',
  Lazada = 'lazada',
  TikTok = 'tiktok',
}

export interface Account {
  id: string
  platform: Platform
  name: string
  credentials: { username: string; password: string }
}

export function summaryChanged(a: ScrapeResult, b: ScrapeResult): boolean {
  const sa = a.summary
  const sb = b.summary
  return sa.toShip !== sb.toShip
    || sa.shipping !== sb.shipping
    || sa.unpaid !== sb.unpaid
    || sa.completed !== sb.completed
    || sa.cancelled !== sb.cancelled
    || sa.toShipUnprocessed !== sb.toShipUnprocessed
    || sa.toShipProcessed !== sb.toShipProcessed
    || a.toShipOrders.length !== b.toShipOrders.length
    || a.shippingOrders.length !== b.shippingOrders.length
}

export const EMPTY_RESULT: ScrapeResult = {
  summary: { unpaid: 0, toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0, shipping: 0, completed: 0, cancelled: 0 },
  toShipOrders: [],
  shippingOrders: [],
}
