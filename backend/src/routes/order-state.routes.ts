import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import type { OrderStateStore, LocalOrderState } from '../infrastructure/order-state.store.js'

export const IMAGE_BASE = process.env.IMAGE_DIR || '/Volumes/public/lonely-monitor/image-verify'

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
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`))
    }
  },
})

const VALID_STATES = ['pending', 'with_stock', 'no_stock', 'admin_completed']
const VALID_REASONS = ['out_of_stock', 'different_variant']
const SAFE_ID = /^[a-zA-Z0-9_-]+$/

interface ValidatedBody {
  error?: string
  state?: string
  reason?: string
  imageUrls?: string[]
  note?: string
}

function validateOrderStateBody(body: Record<string, unknown>): ValidatedBody {
  const { state, reason, imageUrls, note } = body
  if (!state || !VALID_STATES.includes(state as string)) {
    return { error: `state must be one of: ${VALID_STATES.join(', ')}` }
  }
  if (reason && !VALID_REASONS.includes(reason as string)) {
    return { error: 'Invalid reason' }
  }
  if (imageUrls && (!Array.isArray(imageUrls) || !imageUrls.every((u: unknown) => typeof u === 'string'))) {
    return { error: 'imageUrls must be an array of strings' }
  }
  if (note !== undefined && typeof note !== 'string') {
    return { error: 'note must be a string' }
  }
  return {
    state: state as string,
    reason: reason as string | undefined,
    imageUrls: imageUrls as string[] | undefined,
    note: note as string | undefined,
  }
}

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

  // POST /cleanup must come before POST /:orderId to avoid matching 'cleanup' as orderId
  router.post('/cleanup', (_req, res) => {
    try {
      const deleted = store.cleanup(30)
      res.json({ deleted })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  router.post('/:orderId', (req, res) => {
    if (!SAFE_ID.test(req.params.orderId)) {
      res.status(400).json({ error: 'Invalid orderId' })
      return
    }
    try {
      const { orderId } = req.params
      const validated = validateOrderStateBody(req.body)
      if (validated.error) {
        res.status(400).json({ error: validated.error })
        return
      }
      const localState: LocalOrderState = {
        orderId,
        state: validated.state as LocalOrderState['state'],
        reason: validated.reason as LocalOrderState['reason'],
        imageUrls: validated.imageUrls ?? [],
        note: validated.note?.trim() || undefined,
        processedAt: new Date().toISOString(),
      }
      store.set(localState)
      res.status(201).json(localState)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  router.put('/:orderId', (req, res) => {
    if (!SAFE_ID.test(req.params.orderId)) {
      res.status(400).json({ error: 'Invalid orderId' })
      return
    }
    try {
      const { orderId } = req.params
      const validated = validateOrderStateBody(req.body)
      if (validated.error) {
        res.status(400).json({ error: validated.error })
        return
      }
      const existing = store.getAll().find(s => s.orderId === orderId)
      const localState: LocalOrderState = {
        orderId,
        state: validated.state as LocalOrderState['state'],
        reason: validated.reason as LocalOrderState['reason'],
        imageUrls: validated.imageUrls ?? [],
        note: validated.note?.trim() || undefined,
        processedAt: existing?.processedAt ?? new Date().toISOString(),
      }
      store.set(localState)
      res.status(200).json(localState)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  router.delete('/:orderId', (req, res) => {
    if (!SAFE_ID.test(req.params.orderId)) {
      res.status(400).json({ error: 'Invalid orderId' })
      return
    }
    try {
      const existed = store.delete(req.params.orderId)
      if (!existed) {
        res.status(404).json({ error: 'Order state not found' })
        return
      }
      // Return 200 with body (not 204) so JSON clients can parse the response
      res.status(200).json({ ok: true })
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
      // Return relative paths so browsers can load them via /api/images/*
      const imageUrls = files.map(f => path.relative(IMAGE_BASE, f.path))
      res.status(201).json({ imageUrls })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      res.status(500).json({ error: message })
    }
  })

  return router
}
