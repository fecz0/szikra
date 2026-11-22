import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

export type Scenario = 'okos-ipari' | 'elmaradt-szamla' | 'kartya-elutasitva' | 'rendezett-szamlak' | 'kereskedelmi-lanc' | 'napelempark' | 'nagykereskedelem'
export type Role = 'admin' | 'penzugy' | 'muszaki' | 'olvaso' | 'kereskedo'

export interface Seeded { userId: string, partnerId: string }

/**
 * `erp.seed(forgatókönyv, szerepkör)` -> új partner + egyedi felhasználó a háttérben.
 * `erp.login(page, seeded)` -> belépteti a böngészőt (mock SSO), és a partner oldalára visz.
 * Ez váltja ki a kézi, napos adatelőkészítést.
 */
export const test = base.extend<{
  erp: {
    seed: (scenario: Scenario, role?: Role) => Promise<Seeded>
    login: (page: Page, s: Seeded) => Promise<void>
  }
}>({
  erp: async ({ request }, use) => {
    await use({
      async seed(scenario, role = 'admin') {
        const res = await request.post('/__test/seed', { data: { scenario, role } })
        expect(res.ok(), `seed sikertelen: ${await res.text()}`).toBeTruthy()
        return await res.json() as Seeded
      },
      async login(page, s) {
        const res = await page.request.post('/api/auth/login', { data: { userId: s.userId } })
        expect(res.ok(), `belépés sikertelen: ${await res.text()}`).toBeTruthy()
        await page.goto(`/partner/${encodeURIComponent(s.partnerId)}`)
      },
    })
  },
})

export { expect }
