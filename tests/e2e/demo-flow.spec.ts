import { test, expect } from './support/fixtures'

/**
 * A bemutató forgatókönyv (docs/demo/tarifa-szimulator-forgatokonyv.md) végigjátszása.
 * Ha ez zöld, a forgatókönyvben szereplő számok és lépések igazak.
 */
const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Partnerportál menü' })

test('tarifa-szimulátor bemutató forgatókönyv: számla, szimulátor, másik telephely, saját díjcsomag, váltás kérése', async ({ page }) => {
  // 1. belépés és cégválasztás
  await page.goto('/')
  await page.getByTestId('login-DEMO-ADMIN').click()
  await expect(page.getByTestId('company-select')).toBeVisible()
  await page.getByTestId('company-DEMO-LANC').click()

  // 2. valódi vállalkozói számla
  await nav(page).getByRole('link', { name: 'Számlák', exact: true }).click()
  await page.getByTestId('open-DEMO-LANC-INV-E1-202610').click()
  await expect(page.getByTestId('line-EN-FIX')).toContainText('3 971 690')
  await expect(page.getByTestId('line-RH-ATV')).toContainText('3,39')
  await expect(page.getByTestId('line-RH-FORG')).toContainText('22,20')
  await expect(page.getByTestId('network-category')).toHaveText('KIF III.')

  // 3. szimulátor
  await nav(page).getByRole('link', { name: 'Díjcsomagok' }).click()
  await expect(page.getByTestId('tile-kwh')).toContainText('1158 MWh')
  await expect(page.getByTestId('reconcile-diff')).toHaveText('0 Ft')
  const row = (id: string) => page.getByTestId(`sim-${id}`)
  await expect(row('SYS-FIX').getByTestId('sim-annual')).toHaveText('45,03 M Ft')
  await expect(row('SYS-FIX27').getByTestId('sim-annual')).toHaveText('42,72 M Ft')
  await expect(row('SYS-FIX27').getByTestId('sim-saving')).toContainText('2 315 400')
  await expect(row('SYS-PIACI').getByTestId('sim-saving')).toContainText('+3 870 710')
  await expect(row('SYS-CSV').getByTestId('sim-saving')).toContainText('+3 854 650')
  await expect(row('SYS-DIN').getByTestId('sim-saving')).toContainText('+4 301 755')
  await expect(page.getByTestId('dynamic-note')).toContainText('40,08')
  await expect(page.getByTestId('dynamic-note')).toContainText('38,92')
  await row('SYS-FIX27').click()
  await expect(page.getByTestId('sim-monthly').locator('rect.bar')).toHaveCount(12)

  // 4. másik telephely, másik válasz
  await page.getByTestId('sim-site').selectOption('DEMO-LANC-E3')
  await expect(row('SYS-PIACI').getByTestId('current-badge')).toBeVisible()
  await expect(row('SYS-FIX27').getByTestId('sim-saving')).toContainText('4 953 740')
  await expect(row('SYS-DIN').getByTestId('sim-saving')).toContainText('+303 790')
  await expect(page.getByTestId('reconcile-diff')).toHaveText('0 Ft')

  // 5. saját díjcsomag kód nélkül
  await page.getByTestId('sim-site').selectOption('DEMO-LANC-E1')
  const name = `Tavaszi akció fix ${Date.now()}`
  await page.getByTestId('tariff-name').fill(name)
  await page.getByTestId('tariff-fix').fill('35')
  await page.getByTestId('tariff-save').click()
  await expect(page.getByTestId('tariff-message')).toContainText('létrehozva')
  const mine = page.getByTestId('sim-results').locator('tr', { hasText: name })
  await expect(mine).toContainText('egyedi')
  await expect(mine.getByTestId('sim-annual')).toHaveText('40,52 M Ft')
  await expect(mine.getByTestId('sim-saving')).toContainText('4 515 030')
  await expect(page.getByTestId('tile-best')).toContainText(name)

  // 6. váltás kérése, előtöltött ügy
  await row('SYS-FIX27').getByTestId('switch-link').click()
  await expect(page.getByTestId('case-type')).toHaveValue('dijcsomag')
  await expect(page.getByTestId('field-tariff')).toHaveValue('Ipari fix 2027 (12 hó kötés)')
  await expect(page.getByTestId('field-supply')).toHaveValue('DEMO-LANC-E1')
  await page.getByTestId('submit-case').click()
  await expect(page.getByTestId('case-detail')).toContainText('Díjcsomag-váltás')
  await expect(page.getByTestId('case-detail')).toContainText('Ipari fix 2027')
})
