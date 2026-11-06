import { test, expect } from './support/fixtures'

// A hu-HU pénzformátum csoportosító karaktere környezetfüggő lehet,
// ezért a számjegyek között whitespace-t engedünk.
const debtText = (amount: number) =>
  new RegExp(`Nyitott tartozás összesen:\\s*${amount.toLocaleString('hu-HU').replace(/\s/g, '\\s*')}\\s*Ft`)

test('nyitott számlák összege megjelenik a táblázat fölött', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  const summary = page.getByTestId('debt-total')
  await expect(summary).toHaveText(debtText(18450 + 32990))

  // Az összesítő a számlák táblázata fölött van.
  const order = await page
    .locator('[data-testid="debt-total"], table')
    .evaluateAll(els => els.map(el => el.getAttribute('data-testid') ?? el.tagName))
  expect(order).toEqual(['debt-total', 'TABLE'])
})

test('lejárt számlák is beleszámítanak a tartozásba', async ({ page, sap }) => {
  const id = await sap.seed('elmaradt-szamla')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByTestId('debt-total')).toHaveText(debtText(24100 + 21800))
})

test('tartozás nélkül a "Nincs tartozás" szöveg látszik', async ({ page, sap }) => {
  const id = await sap.seed('rendezett-szamlak')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByTestId('debt-total')).toHaveText('Nincs tartozás')
})

test('fizetés után az összesítő azonnal frissül', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByTestId('debt-total')).toHaveText(debtText(18450 + 32990))

  await page.getByTestId(`bill-${id}-B1`).getByRole('button', { name: 'Fizetés' }).click()
  await expect(page.getByRole('status')).toHaveText('Sikeres fizetés')

  await expect(page.getByTestId('debt-total')).toHaveText(debtText(32990))
})
