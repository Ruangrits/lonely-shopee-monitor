import type { AuthGateway } from '../domain/ports.js'

export class CheckAuthUseCase {
  constructor(
    private auth: AuthGateway,
    private username: string,
    private password: string,
  ) {}

  async execute(): Promise<{ loggedIn: boolean }> {
    // Always launch browser — needed for API calls via page.evaluate()
    if (!this.auth.isActive()) {
      await this.auth.launch()
    }

    if (!this.auth.isActive() && this.username && this.password) {
      console.log('Auto-login with credentials from .env...')
      const result = await this.auth.login(this.username, this.password)

      if (result.needsVerification) {
        console.log('Verification required — waiting in background...')
        this.auth.waitForVerification().then((vResult) => {
          if (vResult.success) console.log('Verification successful')
        })
      }
    }

    return { loggedIn: this.auth.isActive() }
  }
}
