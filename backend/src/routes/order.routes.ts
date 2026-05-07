import { Router } from 'express'
import type { FetchOrdersUseCase } from '../usecases/fetch-orders.usecase.js'

export function createOrderRoutes(fetchOrdersList: FetchOrdersUseCase[]) {
  const router = Router()

  router.get('/summary', async (_req, res) => {
    // Fetch fresh data if cache is empty, otherwise return cache
    const cached = fetchOrdersList.map((f) => f.getCached())
    const hasData = cached.some((c) => c.toShipOrders.length > 0 || c.summary.toShip > 0)

    if (!hasData) {
      try {
        await Promise.all(fetchOrdersList.map((f) => f.execute()))
      } catch { /* fallback to cache */ }
    }

    const results = fetchOrdersList.map((f) => f.getCached())
    res.json({ accounts: results })
  })

  router.post('/refresh', async (_req, res) => {
    try {
      await Promise.all(fetchOrdersList.map((f) => f.execute()))
      const results = fetchOrdersList.map((f) => f.getCached())
      res.json({ accounts: results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
