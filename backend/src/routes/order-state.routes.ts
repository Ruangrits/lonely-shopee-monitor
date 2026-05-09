import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import type { OrderStateStore, LocalOrderState } from '../infrastructure/order-state.store.js'

const IMAGE_BASE = '/Volumes/public/lonely-monitor/image-verify'

function getUploadDir(orderId: string): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return path.join(IMAGE_BASE, `${dd}-${mm}-${yyyy}`, orderId)
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId
    const dir = getUploadDir(orderId)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}${ext}`)
  },
})

const upload = multer({ storage })

export function createOrderStateRoutes(store: OrderStateStore) {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(store.getAll())
  })

  router.post('/:orderId', (req, res) => {
    const { orderId } = req.params
    const { state, reason, imageUrls } = req.body as {
      state: 'with_stock' | 'no_stock'
      reason?: 'out_of_stock' | 'different_variant'
      imageUrls?: string[]
    }

    const localState: LocalOrderState = {
      orderId,
      state,
      reason,
      imageUrls: imageUrls ?? [],
      processedAt: new Date().toISOString(),
    }

    store.set(localState)
    res.json(localState)
  })

  return router
}

export function createUploadRoutes() {
  const router = Router()

  router.post('/:orderId', upload.array('images'), (req, res) => {
    const files = req.files as Express.Multer.File[]
    const imageUrls = files.map(f => f.path)
    res.json({ imageUrls })
  })

  return router
}
