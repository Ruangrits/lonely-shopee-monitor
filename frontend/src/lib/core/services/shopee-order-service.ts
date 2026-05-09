import { Blizzard } from 'th-lonely-universe-web-lib/blizzard'
import { Either } from 'th-lonely-universe-web-lib/fp'
import type { Future } from 'th-lonely-universe-web-lib/async'
import type { AuthStatus, MultiAccountResponse } from '$lib/modules/dashboard/data'
//
const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
	? `${window.location.protocol}//${window.location.hostname}:3001`
	: 'http://localhost:3001')
const client = Blizzard(API_BASE, { 'Content-Type': 'application/json' })

export const shopeeOrderService = {
	getAuthStatus(): Future<unknown, AuthStatus> {
		return client.get('/api/auth/status').fetch().readToJson()
			.deserialize<unknown, AuthStatus>((j) => Either.Right(j as AuthStatus)).toFuture()
	},

	getSummary(): Future<unknown, MultiAccountResponse> {
		return client.get('/api/orders/summary').fetch().readToJson()
			.deserialize<unknown, MultiAccountResponse>((j) => Either.Right(j as MultiAccountResponse)).toFuture()
	},

	refreshOrders(): Future<unknown, MultiAccountResponse> {
		return client.post('/api/orders/refresh').withBody('{}').fetch().readToJson()
			.deserialize<unknown, MultiAccountResponse>((j) => Either.Right(j as MultiAccountResponse)).toFuture()
	},
}
