export interface OrderItem {
	productName: string
	variant: string
	quantity: number
	imageUrl: string
}

export type Platform = 'shopee' | 'lazada' | 'tiktok'

export interface Order {
	orderId: string
	buyerName: string
	orderTime: string
	items: OrderItem[]
	status: string
	accountName?: string
	platform?: Platform
}

export interface OrderSummary {
	toShip: number
	toShipUnprocessed: number
	toShipProcessed: number
}

export interface AccountResult {
	accountId: string
	accountName: string
	platform: Platform
	summary: OrderSummary
	toShipOrders: Order[]
	scrapedAt: string
}

export interface MultiAccountResponse {
	accounts: AccountResult[]
}

export interface AuthStatus {
	loggedIn: boolean
	accounts?: Array<{ loggedIn: boolean }>
}
