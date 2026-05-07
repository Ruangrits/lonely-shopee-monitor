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
  toShip: number
  toShipUnprocessed: number
  toShipProcessed: number
}

export interface ScrapeResult {
  accountId: string
  accountName: string
  platform: Platform
  summary: OrderSummary
  toShipOrders: Order[]
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
  if (a.accountId !== b.accountId) return true
  const sa = a.summary
  const sb = b.summary
  return sa.toShip !== sb.toShip
    || sa.toShipUnprocessed !== sb.toShipUnprocessed
    || sa.toShipProcessed !== sb.toShipProcessed
    || a.toShipOrders.length !== b.toShipOrders.length
}

export const EMPTY_RESULT: ScrapeResult = {
  accountId: '',
  accountName: '',
  platform: Platform.Shopee,
  summary: { toShip: 0, toShipUnprocessed: 0, toShipProcessed: 0 },
  toShipOrders: [],
}
