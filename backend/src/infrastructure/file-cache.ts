import type { CachePort } from '../domain/ports.js'
import fs from 'fs'
import path from 'path'

export class FileCache<T> implements CachePort<T> {
  private scrapedAt = ''

  constructor(private filePath: string) {}

  load(): T | null {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))
        this.scrapedAt = raw.scrapedAt || ''
        console.log(`Cache loaded (scraped at ${this.scrapedAt})`)
        return raw.result as T
      }
    } catch {
      console.log('No cache found, starting fresh')
    }
    return null
  }

  save(data: T, scrapedAt: string): void {
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      this.scrapedAt = scrapedAt
      fs.writeFileSync(this.filePath, JSON.stringify({ result: data, scrapedAt }), 'utf-8')
    } catch (err) {
      console.error('Failed to save cache:', err)
    }
  }

  getScrapedAt(): string { return this.scrapedAt }
}
