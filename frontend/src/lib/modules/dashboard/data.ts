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
	accountName?: string
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

export interface AccountResult {
	accountId: string
	accountName: string
	summary: OrderSummary
	toShipOrders: Order[]
	shippingOrders: Order[]
	scrapedAt: string
}

export interface MultiAccountResponse {
	accounts: AccountResult[]
}

export interface AuthStatus {
	loggedIn: boolean
	accounts?: Array<{ loggedIn: boolean }>
}

export interface PollingStatus {
	active: boolean
	interval: number
}
