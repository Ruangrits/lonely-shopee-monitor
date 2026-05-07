import type { Scheduler } from '../domain/ports.js'
import type { FetchOrdersUseCase } from './fetch-orders.usecase.js'
import type { CheckAuthUseCase } from './check-auth.usecase.js'

export class ManagePollingUseCase {
  constructor(
    private fetchOrdersList: FetchOrdersUseCase[],
    private checkAuthList: CheckAuthUseCase[],
    private scheduler: Scheduler,
  ) {}

  start(): void {
    this.scheduler.start(async () => {
      for (let i = 0; i < this.fetchOrdersList.length; i++) {
        await this.checkAuthList[i].execute()   // re-auth if session expired
        await this.fetchOrdersList[i].execute()
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
