import fs from 'fs'
import path from 'path'

export interface LocalOrderState {
  orderId: string
  state: 'pending' | 'with_stock' | 'no_stock' | 'admin_completed'
  reason?: 'out_of_stock' | 'different_variant'
  imageUrls: string[]
  note?: string
  processedAt: string
}

export class OrderStateStore {
  private states: Map<string, LocalOrderState> = new Map()

  constructor(private filePath: string) {
    this.load()
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as LocalOrderState[]
        for (const s of data) this.states.set(s.orderId, s)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.warn(`Failed to load order states from ${this.filePath}: ${errorMsg}. Starting with empty state.`)
    }
  }

  private persist(): void {
    try {
      const dir = path.dirname(this.filePath)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify([...this.states.values()], null, 2))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to persist order states to ${this.filePath}: ${errorMsg}`)
      throw new Error(`Failed to persist order state: ${errorMsg}`)
    }
  }

  getAll(): LocalOrderState[] {
    return [...this.states.values()]
  }

  set(state: LocalOrderState): void {
    if (!state.orderId || !state.orderId.trim()) {
      throw new Error('orderId is required and cannot be empty')
    }
    if (!state.processedAt) {
      throw new Error('processedAt is required')
    }
    this.states.set(state.orderId, state)
    this.persist()
  }

  delete(orderId: string): boolean {
    const existed = this.states.has(orderId)
    if (existed) {
      this.states.delete(orderId)
      this.persist()
    }
    return existed
  }

  cleanup(olderThanDays: number): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    let deleted = 0
    for (const [id, state] of this.states) {
      if (state.state === 'admin_completed' && new Date(state.processedAt).getTime() < cutoff) {
        this.states.delete(id)
        deleted++
      }
    }
    if (deleted > 0) this.persist()
    return deleted
  }
}
