import { Router } from 'express'
import type { FetchOrdersUseCase } from '../usecases/fetch-orders.usecase.js'

export function createOrderRoutes(fetchOrders: FetchOrdersUseCase) {
  const router = Router()

  router.get('/summary', (_req, res) => {
    res.json(fetchOrders.getCached())
  })

  router.post('/refresh', async (_req, res) => {
    try {
      const result = await fetchOrders.execute()
      res.json({ ...result, scrapedAt: new Date().toISOString() })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
