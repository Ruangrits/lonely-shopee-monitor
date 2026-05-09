import { Blizzard } from 'th-lonely-universe-web-lib/blizzard'
import { Either } from 'th-lonely-universe-web-lib/fp'
import type { Future } from 'th-lonely-universe-web-lib/async'
import type { LocalOrderState } from './data'

const API_BASE = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001')

const client = Blizzard(API_BASE, { 'Content-Type': 'application/json' })

export const orderProcessingService = {
  getOrderStates(): Future<unknown, LocalOrderState[]> {
    return client.get('/api/order-states').fetch().readToJson()
      .deserialize<unknown, LocalOrderState[]>((j) => Either.Right(j as LocalOrderState[]))
      .toFuture()
  },

  setOrderState(
    orderId: string,
    payload: { state: LocalOrderState['state']; reason?: LocalOrderState['reason']; imageUrls: string[]; note?: string }
  ): Future<unknown, LocalOrderState> {
    return client.post(`/api/order-states/${orderId}`)
      .withBody(JSON.stringify(payload))
      .fetch().readToJson()
      .deserialize<unknown, LocalOrderState>((j) => Either.Right(j as LocalOrderState))
      .toFuture()
  },

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
