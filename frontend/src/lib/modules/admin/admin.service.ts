import { Blizzard } from 'th-lonely-universe-web-lib/blizzard'
import { Either } from 'th-lonely-universe-web-lib/fp'
import type { Future } from 'th-lonely-universe-web-lib/async'
import type { LocalOrderState } from '$lib/modules/order-processing/data'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001')

const client = Blizzard(API_BASE, { 'Content-Type': 'application/json' })

type StatePayload = {
  state: LocalOrderState['state']
  reason?: LocalOrderState['reason']
  imageUrls: string[]
  note?: string
}

export const adminService = {
  /** Create a new state entry (POST) — used when order has no localState yet */
  createOrderState(orderId: string, payload: StatePayload): Future<unknown, LocalOrderState> {
    return client.post(`/api/order-states/${orderId}`)
      .withBody(JSON.stringify(payload)).fetch().readToJson()
      .deserialize<unknown, LocalOrderState>((j) => Either.Right(j as LocalOrderState)).toFuture()
  },

  /** Overwrite an existing state entry (PUT) — used when order already has localState */
  updateOrderState(orderId: string, payload: StatePayload): Future<unknown, LocalOrderState> {
    return client.put(`/api/order-states/${orderId}`)
      .withBody(JSON.stringify(payload)).fetch().readToJson()
      .deserialize<unknown, LocalOrderState>((j) => Either.Right(j as LocalOrderState)).toFuture()
  },

  /** Delete state entry → order returns to pending (DELETE returns 200 { ok: true }) */
  deleteOrderState(orderId: string): Future<unknown, void> {
    return client.delete(`/api/order-states/${orderId}`)
      .fetch().readToJson()
      .deserialize<unknown, void>(() => Either.Right(undefined)).toFuture()
  },

  /** Delete admin_completed entries older than 30 days */
  cleanup(): Future<unknown, { deleted: number }> {
    return client.post('/api/order-states/cleanup').withBody('{}').fetch().readToJson()
      .deserialize<unknown, { deleted: number }>((j) => Either.Right(j as { deleted: number })).toFuture()
  },

  /** Upload images for an order, returns relative paths usable as /api/images/{path} */
  async uploadImages(orderId: string, files: File[]): Promise<{ imageUrls: string[] }> {
    const formData = new FormData()
    for (const file of files) formData.append('images', file)
    const res = await fetch(`${API_BASE}/api/uploads/${orderId}`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
    return res.json() as Promise<{ imageUrls: string[] }>
  },
}
