import type { OrderGateway } from '../domain/ports.js'
import type { ScrapeResult } from '../domain/entities.js'
import { EMPTY_RESULT } from '../domain/entities.js'

export class FetchOrdersUseCase {
  private latestResult: ScrapeResult = EMPTY_RESULT
  private scrapedAt: string = ''

  constructor(private gateway: OrderGateway) {}

  async execute(): Promise<ScrapeResult & { scrapedAt: string }> {
    try {
      const result = await this.gateway.fetchAll()

      if (result.accountId) {
        this.latestResult = result
        this.scrapedAt = new Date().toISOString()
      }

      return { ...this.latestResult, scrapedAt: this.scrapedAt }
    } catch (err) {
      console.error('Fetch error:', err)
      return { ...this.latestResult, scrapedAt: this.scrapedAt }
    }
  }

  getLatest(): ScrapeResult & { scrapedAt: string } {
    return { ...this.latestResult, scrapedAt: this.scrapedAt }
  }
}
