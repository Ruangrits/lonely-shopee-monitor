import type { Scheduler } from '../domain/ports.js'

export class IntervalScheduler implements Scheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private intervalMs: number
  private callback: (() => void | Promise<void>) | null = null

  constructor(defaultIntervalMs = 300_000) {
    this.intervalMs = defaultIntervalMs
  }

  start(callback: () => void | Promise<void>, intervalMs: number): void {
    if (this.intervalId) return
    this.callback = callback
    this.intervalMs = intervalMs
    console.log(`Polling started (every ${this.intervalMs / 1000}s)`)
    this.intervalId = setInterval(callback, this.intervalMs)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Polling stopped')
    }
  }

  setInterval(intervalMs: number): void {
    this.intervalMs = intervalMs
    if (this.intervalId && this.callback) {
      this.stop()
      this.start(this.callback, this.intervalMs)
    }
  }

  isRunning(): boolean { return this.intervalId !== null }
  getIntervalMs(): number { return this.intervalMs }
}
