import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { ShopeeAuthGateway } from './infrastructure/shopee/shopee-auth.gateway.js'
import { ShopeeApiGateway } from './infrastructure/shopee/shopee-api.gateway.js'
import { FileCache } from './infrastructure/file-cache.js'
import { IntervalScheduler } from './infrastructure/interval-scheduler.js'

import { CheckAuthUseCase } from './usecases/check-auth.usecase.js'
import { FetchOrdersUseCase } from './usecases/fetch-orders.usecase.js'
import { ManagePollingUseCase } from './usecases/manage-polling.usecase.js'

import { createAuthRoutes } from './routes/auth.routes.js'
import { createOrderRoutes } from './routes/order.routes.js'
import { createSettingsRoutes } from './routes/settings.routes.js'

import type { ScrapeResult } from './domain/entities.js'

dotenv.config()

// --- Infrastructure ---
const shopeeAuth = new ShopeeAuthGateway()
const shopeeApi = new ShopeeApiGateway(shopeeAuth)
const cache = new FileCache<ScrapeResult>('./data/cache.json')
const scheduler = new IntervalScheduler(
  parseInt(process.env.POLLING_INTERVAL || '300') * 1000
)

// --- Use Cases ---
const checkAuth = new CheckAuthUseCase(
  shopeeAuth,
  process.env.SHOPEE_USERNAME || '',
  process.env.SHOPEE_PASSWORD || '',
)
const fetchOrders = new FetchOrdersUseCase(shopeeApi, cache)
const managePolling = new ManagePollingUseCase(fetchOrders, scheduler)

// --- App ---
const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', createAuthRoutes(checkAuth, managePolling))
app.use('/api/orders', createOrderRoutes(fetchOrders))
app.use('/api/settings', createSettingsRoutes(managePolling))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, closing browser...`)
    await shopeeAuth.close()
    process.exit(0)
  })
}
