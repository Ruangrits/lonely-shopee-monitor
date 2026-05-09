import fs from 'fs'
import path from 'path'

export interface LocalOrderState {
  orderId: string
  state: 'with_stock' | 'no_stock'
  reason?: 'out_of_stock' | 'different_variant'
  imageUrls: string[]
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
    } catch { /* start empty */ }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(this.filePath, JSON.stringify([...this.states.values()], null, 2))
  }

  getAll(): LocalOrderState[] {
    return [...this.states.values()]
  }

  set(state: LocalOrderState): void {
    this.states.set(state.orderId, state)
    this.persist()
  }
}
