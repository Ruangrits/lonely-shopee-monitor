import type { ScrapeResult } from './entities.js'

export interface AuthResult {
  success: boolean
  needsVerification: boolean
  error?: string
}

export interface AuthGateway {
  launch(): Promise<void>
  login(username: string, password: string): Promise<AuthResult>
  waitForVerification(): Promise<{ success: boolean; error?: string }>
  isActive(): boolean
  close(): Promise<void>
}

export interface OrderGateway {
  fetchAll(): Promise<ScrapeResult>
}


export interface Scheduler {
  start(callback: () => void | Promise<void>, intervalMs: number): void
  stop(): void
  setInterval(intervalMs: number): void
  isRunning(): boolean
  getIntervalMs(): number
}
