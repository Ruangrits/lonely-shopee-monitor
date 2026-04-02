import { Router } from 'express'
import type { FetchOrdersUseCase } from '../usecases/fetch-orders.usecase.js'

export function createOrderRoutes(fetchOrdersList: FetchOrdersUseCase[]) {
  const router = Router()

  router.get('/summary', (_req, res) => {
    const results = fetchOrdersList.map((f) => f.getCached())
    res.json({ accounts: results })
  })

  router.post('/refresh', async (_req, res) => {
    try {
      const results = await Promise.all(fetchOrdersList.map((f) => f.execute()))
      res.json({ accounts: results.map((r) => ({ ...r, scrapedAt: new Date().toISOString() })) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
