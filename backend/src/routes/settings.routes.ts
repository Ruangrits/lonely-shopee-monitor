import { Router } from 'express'
import type { ManagePollingUseCase } from '../usecases/manage-polling.usecase.js'

export function createSettingsRoutes(polling: ManagePollingUseCase) {
  const router = Router()

  router.patch('/interval', (req, res) => {
    const { seconds } = req.body
    if (!seconds || typeof seconds !== 'number' || seconds < 10) {
      res.status(400).json({ error: 'Interval must be at least 10 seconds' })
      return
    }
    polling.setInterval(seconds)
    res.json({ interval: seconds })
  })

  router.get('/polling', (_req, res) => {
    res.json(polling.getStatus())
  })

  router.post('/polling/start', (_req, res) => {
    polling.start()
    res.json({ active: true })
  })

  router.post('/polling/stop', (_req, res) => {
    polling.stop()
    res.json({ active: false })
  })

  return router
}
