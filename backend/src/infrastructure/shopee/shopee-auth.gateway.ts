import { chromium, type BrowserContext, type Page } from 'playwright'
import type { AuthGateway, AuthResult } from '../../domain/ports.js'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

const SELLER_CENTRE_URL = 'https://seller.shopee.co.th'
const LOGIN_URL = `${SELLER_CENTRE_URL}/account/signin`
const ORDER_URL = `${SELLER_CENTRE_URL}/portal/sale`
export class ShopeeAuthGateway implements AuthGateway {
  private context: BrowserContext | null = null
  private page: Page | null = null
  private loggedIn = false
  private _cookies: string = ''

  constructor(private profileDir: string) {}

  get cookies(): string { return this._cookies }

  async launch() {
    await this.close()
    const headless = process.env.HEADLESS !== 'false'

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        this.context = await chromium.launchPersistentContext(this.profileDir, {
          headless,
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          locale: 'th-TH',
        })
        this.page = this.context.pages()[0] || await this.context.newPage()
        console.log(`Browser launched (attempt ${attempt}, headless: ${headless})`)
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : ''
        console.error(`Launch attempt ${attempt} failed:`, msg)
        if (msg.includes('ProcessSingleton') || msg.includes('profile directory')) {
          try { execSync('pkill -f "Google Chrome for Testing.*browser-profile" 2>/dev/null || true') } catch { /* */ }
          const lockFile = path.join(this.profileDir, 'SingletonLock')
          if (fs.existsSync(lockFile)) fs.rmSync(lockFile)
          await new Promise((r) => setTimeout(r, 2000))
        } else {
          throw err
        }
      }
    }

    if (!this.context) throw new Error('Failed to launch browser after retries')
    await this.checkExistingSession()
  }

  private async checkExistingSession() {
    if (!this.page) return
    try {
      console.log('Checking existing session...')
      await this.page.goto(ORDER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await this.page.waitForTimeout(3000)
      const currentUrl = this.page.url()
      if (currentUrl.includes('/portal') || currentUrl.includes('is_from_login') || currentUrl === `${SELLER_CENTRE_URL}/`) {
        this.loggedIn = true
        await this.extractCookies()
        console.log('Existing session active — cookies extracted')
      } else {
        console.log('No existing session — login required')
      }
    } catch {
      console.log('Session check failed — login required')
    }
  }

  private async dismissLanguageDialog() {
    if (!this.page) return
    try {
      const thaiBtn = this.page.locator('text=ไทย').first()
      if (await thaiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await thaiBtn.click()
        await this.page.waitForTimeout(2000)
      }
    } catch { /* */ }
  }

  async login(username: string, password: string): Promise<AuthResult> {
    if (!this.page) throw new Error('Browser not launched')
    try {
      await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await this.page.waitForTimeout(3000)
      await this.dismissLanguageDialog()

      const usernameSelectors = [
        'input[type="text"]',
        'input[name="username"]',
        'input[name="loginKey"]',
        'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])',
      ]
      let usernameInput = null
      for (const sel of usernameSelectors) {
        if (await this.page.locator(sel).first().isVisible().catch(() => false)) {
          usernameInput = this.page.locator(sel).first()
          break
        }
      }
      if (!usernameInput) return { success: false, needsVerification: false, error: 'ไม่พบช่องกรอก username' }

      await usernameInput.fill(username)
      const passwordInput = this.page.locator('input[type="password"]').first()
      if (!await passwordInput.isVisible().catch(() => false)) return { success: false, needsVerification: false, error: 'ไม่พบช่องกรอก password' }
      await passwordInput.fill(password)

      for (const sel of ['button[type="submit"]', 'button:has-text("เข้าสู่ระบบ")', 'button:has-text("Log In")']) {
        if (await this.page.locator(sel).first().isVisible().catch(() => false)) {
          await this.page.locator(sel).first().click()
          break
        }
      }

      try {
        await this.page.waitForURL((url) => url.pathname.includes('/portal') || url.search.includes('is_from_login'), { timeout: 10000 })
        this.loggedIn = true
        await this.extractCookies()
        return { success: true, needsVerification: false }
      } catch {
        const pageContent = await this.page.content()
        if (pageContent.includes('verify') || pageContent.includes('ยืนยัน') || pageContent.includes('OTP')) {
          return { success: false, needsVerification: true }
        }
        return { success: false, needsVerification: false, error: 'Login ไม่สำเร็จ' }
      }
    } catch (err) {
      return { success: false, needsVerification: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  async waitForVerification(): Promise<{ success: boolean; error?: string }> {
    if (!this.page) throw new Error('Browser not launched')
    try {
      await this.page.waitForURL((url) => url.pathname.includes('/portal') || url.search.includes('is_from_login'), { timeout: 120000 })
      this.loggedIn = true
      await this.extractCookies()
      return { success: true }
    } catch {
      return { success: false, error: 'หมดเวลารอการยืนยัน' }
    }
  }

  private async extractCookies() {
    if (!this.context) return
    const cookies = await this.context.cookies(SELLER_CENTRE_URL)
    this._cookies = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
    console.log(`Extracted ${cookies.length} cookies`)
  }

  isActive(): boolean {
    if (this.loggedIn && this.context) {
      try {
        if (this.context.pages().length === 0) { this.reset(); return false }
        return true
      } catch { this.reset(); return false }
    }
    return false
  }

  private reset() {
    this.context = null
    this.page = null
    this.loggedIn = false
    this._cookies = ''
  }

  async close() {
    if (this.context) {
      await this.context.close().catch(() => {})
      this.reset()
      console.log('Browser closed')
    }
  }
}
