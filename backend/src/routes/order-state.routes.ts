import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import type { OrderStateStore, LocalOrderState } from '../infrastructure/order-state.store.js'

const IMAGE_BASE = '/Volumes/public/lonely-monitor/image-verify'

function getUploadDir(orderId: string): string {
  if (!orderId || !/^[a-zA-Z0-9_-]+$/.test(orderId)) {
    throw new Error(`Invalid orderId: ${orderId}`)
  }
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  return path.join(IMAGE_BASE, `${dd}-${mm}-${yyyy}`, orderId)
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId
        const dir = getUploadDir(orderId)
        fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create upload directory')
        cb(error as NodeJS.ErrnoException, '')
      }
    },
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || '.jpg'
      cb(null, `${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))
    }
  },
})

export function createOrderStateRoutes(store: OrderStateStore) {
  const router = Router()

  router.get('/', (_req, res) => {
    try {
      res.json(store.getAll())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  router.post('/:orderId', (req, res) => {
    try {
      const { orderId } = req.params
      const { state, reason, imageUrls } = req.body

      const validStates = ['with_stock', 'no_stock']
      if (!state || !validStates.includes(state)) {
        res.status(400).json({ error: 'state must be "with_stock" or "no_stock"' })
        return
      }

      const validReasons = ['out_of_stock', 'different_variant']
      if (reason && !validReasons.includes(reason)) {
        res.status(400).json({ error: 'Invalid reason' })
        return
      }

      if (imageUrls && (!Array.isArray(imageUrls) || !imageUrls.every((u: unknown) => typeof u === 'string'))) {
        res.status(400).json({ error: 'imageUrls must be an array of strings' })
        return
      }

      const localState: LocalOrderState = {
        orderId,
        state: state as 'with_stock' | 'no_stock',
        reason: reason as 'out_of_stock' | 'different_variant' | undefined,
        imageUrls: imageUrls ?? [],
        processedAt: new Date().toISOString(),
      }

      store.set(localState)
      res.status(201).json(localState)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}

export function createUploadRoutes() {
  const router = Router()

  router.post('/:orderId', upload.array('images'), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' })
        return
      }
      const imageUrls = files.map(f => f.path)
      res.status(201).json({ imageUrls })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
