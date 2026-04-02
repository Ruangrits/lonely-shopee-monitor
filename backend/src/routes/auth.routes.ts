import { Router } from 'express'
import type { CheckAuthUseCase } from '../usecases/check-auth.usecase.js'
import type { ManagePollingUseCase } from '../usecases/manage-polling.usecase.js'

export function createAuthRoutes(checkAuthList: CheckAuthUseCase[], polling: ManagePollingUseCase) {
  const router = Router()

  router.get('/status', async (_req, res) => {
    try {
      const results = await Promise.all(checkAuthList.map((c) => c.execute()))
      const allLoggedIn = results.every((r) => r.loggedIn)
      if (allLoggedIn) polling.start()
      res.json({ loggedIn: allLoggedIn, accounts: results })
    } catch (err) {
      console.error('Auth status error:', err)
      res.json({ loggedIn: false, accounts: [] })
    }
  })

  return router
}
