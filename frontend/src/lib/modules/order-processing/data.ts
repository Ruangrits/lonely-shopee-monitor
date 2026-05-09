export type { Order, OrderItem } from '$lib/modules/dashboard/data'

export type LocalOrderStateValue = 'with_stock' | 'no_stock' | 'admin_completed'
export type NoStockReason = 'out_of_stock' | 'different_variant'

export interface LocalOrderState {
  orderId: string
  state: LocalOrderStateValue
  reason?: NoStockReason
  imageUrls: string[]
  note?: string
  processedAt: string
}
