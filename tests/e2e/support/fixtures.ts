import { test as base, expect } from '@playwright/test'

export type Scenario = 'okosmero-gaz-villany' | 'elmaradt-szamla' | 'kartya-elutasitva' | 'rendezett-szamlak'

/**
 * `sap.seed(forgatókönyv)` -> létrehozza a teszt SAP-objektumot a mockban
 * és visszaadja az egyedi ügyfélazonosítót. Ez váltja ki a kézi, napos beállítást.
 */
export const test = base.extend<{
  sap: { seed: (scenario: Scenario) => Promise<string> }
}>({
  sap: async ({ request }, use) => {
    await use({
      async seed(scenario) {
        const res = await request.post('/mock-sap/__seed', { data: { scenario } })
        expect(res.ok(), `seed sikertelen: ${await res.text()}`).toBeTruthy()
        return (await res.json()).customerId as string
      },
    })
  },
})

export { expect }
