import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

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

// --- Data directory (configurable via .env) ---
const dataDir = path.resolve(process.env.DATA_DIR || './data')

// --- Accounts config ---
const accounts = [
  {
    id: 'lonely-universe',
    name: 'lonely universe',
    username: process.env.SHOPEE_USERNAME || '',
    password: process.env.SHOPEE_PASSWORD || '',
    profileDir: path.join(dataDir, 'browser-profile-1'),
    cacheFile: path.join(dataDir, 'cache-1.json'),
  },
  {
    id: 'alone-in-universe',
    name: 'alone in universe',
    username: process.env.SHOPEE_USERNAME_2 || '',
    password: process.env.SHOPEE_PASSWORD_2 || '',
    profileDir: path.join(dataDir, 'browser-profile-2'),
    cacheFile: path.join(dataDir, 'cache-2.json'),
  },
].filter((a) => a.username) // only create accounts with credentials

// --- Per-account infrastructure + use cases ---
const checkAuthList: CheckAuthUseCase[] = []
const fetchOrdersList: FetchOrdersUseCase[] = []
const authGateways: ShopeeAuthGateway[] = []

for (const account of accounts) {
  const auth = new ShopeeAuthGateway(account.profileDir)
  const api = new ShopeeApiGateway(auth, account.id, account.name)
  const cache = new FileCache<ScrapeResult>(account.cacheFile)

  checkAuthList.push(new CheckAuthUseCase(auth, account.username, account.password))
  fetchOrdersList.push(new FetchOrdersUseCase(api, cache))
  authGateways.push(auth)
}

// --- Shared ---
const scheduler = new IntervalScheduler(
  parseInt(process.env.POLLING_INTERVAL || '300') * 1000
)
const managePolling = new ManagePollingUseCase(fetchOrdersList, checkAuthList, scheduler)

// --- App ---
const app = express()
const port = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', createAuthRoutes(checkAuthList, managePolling))
app.use('/api/orders', createOrderRoutes(fetchOrdersList))
app.use('/api/settings', createSettingsRoutes(managePolling))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})

// Graceful shutdown — close ALL browsers
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, closing browsers...`)
    await Promise.all(authGateways.map((a) => a.close()))
    process.exit(0)
  })
}
