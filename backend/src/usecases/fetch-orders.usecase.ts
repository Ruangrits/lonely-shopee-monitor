import type { OrderGateway, CachePort } from '../domain/ports.js'
import type { ScrapeResult } from '../domain/entities.js'
import { EMPTY_RESULT, summaryChanged } from '../domain/entities.js'

export class FetchOrdersUseCase {
  private latestResult: ScrapeResult

  constructor(
    private gateway: OrderGateway,
    private cache: CachePort<ScrapeResult>,
  ) {
    this.latestResult = cache.load() || EMPTY_RESULT
  }

  async execute(): Promise<ScrapeResult> {
    try {
      const newResult = await this.gateway.fetchAll()

      // No browser page available — preserve existing cache
      if (!newResult.accountId) {
        return this.latestResult
      }

      const now = new Date().toISOString()

      if (summaryChanged(this.latestResult, newResult)) {
        console.log('Data changed — updating cache')
        this.latestResult = newResult
        this.cache.save(newResult, now)
      } else {
        console.log('Data unchanged — keeping cache')
      }

      return this.latestResult
    } catch (err) {
      console.error('Fetch error:', err)
      return this.latestResult
    }
  }

  getCached(): ScrapeResult & { scrapedAt: string } {
    return { ...this.latestResult, scrapedAt: this.cache.getScrapedAt() }
  }
}
