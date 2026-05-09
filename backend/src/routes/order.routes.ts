import { Router } from 'express'
import type { FetchOrdersUseCase } from '../usecases/fetch-orders.usecase.js'

export function createOrderRoutes(fetchOrdersList: FetchOrdersUseCase[]) {
  const router = Router()

  router.get('/summary', async (_req, res) => {
    try {
      const results = await Promise.all(fetchOrdersList.map((f) => f.execute()))
      res.json({ accounts: results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  router.post('/refresh', async (_req, res) => {
    try {
      const results = await Promise.all(fetchOrdersList.map((f) => f.execute()))
      res.json({ accounts: results })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
