import type { Scheduler } from '../domain/ports.js'
import type { FetchOrdersUseCase } from './fetch-orders.usecase.js'

export class ManagePollingUseCase {
  constructor(
    private fetchOrdersList: FetchOrdersUseCase[],
    private scheduler: Scheduler,
  ) {}

  start(): void {
    this.scheduler.start(async () => {
      for (const fetchOrders of this.fetchOrdersList) {
        await fetchOrders.execute()
      }
    }, this.scheduler.getIntervalMs())
  }

  stop(): void {
    this.scheduler.stop()
  }

  setInterval(seconds: number): void {
    this.scheduler.setInterval(seconds * 1000)
  }

  getStatus(): { active: boolean; interval: number } {
    return {
      active: this.scheduler.isRunning(),
      interval: this.scheduler.getIntervalMs() / 1000,
    }
  }
}
