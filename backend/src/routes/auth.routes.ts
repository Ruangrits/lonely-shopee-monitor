import { Router } from 'express'
import type { CheckAuthUseCase } from '../usecases/check-auth.usecase.js'
import type { ManagePollingUseCase } from '../usecases/manage-polling.usecase.js'

export function createAuthRoutes(checkAuth: CheckAuthUseCase, polling: ManagePollingUseCase) {
  const router = Router()

  router.get('/status', async (_req, res) => {
    try {
      const { loggedIn } = await checkAuth.execute()
      if (loggedIn) polling.start()
      res.json({ loggedIn })
    } catch (err) {
      console.error('Auth status error:', err)
      res.json({ loggedIn: false })
    }
  })

  return router
}
