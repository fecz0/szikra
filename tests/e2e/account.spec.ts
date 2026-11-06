import { test, expect } from './support/fixtures'

test('okosmérős ügyfél: villany + gáz mérő és számlák látszanak', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')

  await page.goto('/')
  await page.getByLabel('Ügyfélazonosító').fill(id)
  await page.getByRole('button', { name: 'Belépés' }).click()

  await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
  await expect(page.getByTestId('meter-villany')).toContainText('Okosmérő')
  await expect(page.getByTestId('meter-gaz')).toContainText('Okosmérő')
  await expect(page.getByTestId('payment-method')).toContainText('4242')
  await expect(page.getByRole('row', { name: /Fizetés/ })).toHaveCount(2)
})

test('ismeretlen ügyfélazonosító hibaoldalt ad', async ({ page }) => {
  await page.goto('/fiok/NEMLETEZIK')
  await expect(page.getByRole('alert')).toContainText('Nem található ügyfél')
})

test('lejárt számlák jelölve vannak', async ({ page, sap }) => {
  const id = await sap.seed('elmaradt-szamla')
  await page.goto(`/fiok/${id}`)
  await expect(page.getByTestId('bill-status')).toHaveText(['Lejárt', 'Lejárt'])
})
