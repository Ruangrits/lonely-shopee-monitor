export type { Order, OrderItem } from '$lib/modules/dashboard/data'

export type LocalOrderStateValue = 'with_stock' | 'no_stock'
export type NoStockReason = 'out_of_stock' | 'different_variant'

export interface LocalOrderState {
  orderId: string
  state: LocalOrderStateValue
  reason?: NoStockReason
  imageUrls: string[]
  processedAt: string
}

export interface ProcessingOrder {
  orderId: string
  buyerName: string
  orderTime: string
  items: Array<{ productName: string; variant: string; quantity: number; imageUrl: string }>
  status: string
  accountName?: string
  platform?: string
}

export interface ProcessedOrderEntry extends ProcessingOrder {
  localState: LocalOrderState
}
