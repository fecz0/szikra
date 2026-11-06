import { test, expect } from './support/fixtures'

test.describe('mock SAP szerződés', () => {
  test('ismeretlen forgatókönyvre 400-at ad', async ({ request }) => {
    const res = await request.post('/mock-sap/__seed', { data: { scenario: 'nincs-ilyen' } })
    expect(res.status()).toBe(400)
  })

  test('minden seedelés egyedi azonosítót ad (párhuzamosság)', async ({ sap }) => {
    const ids = await Promise.all([1, 2, 3, 4, 5].map(() => sap.seed('okosmero-gaz-villany')))
    expect(new Set(ids).size).toBe(5)
  })
})
