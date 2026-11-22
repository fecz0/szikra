import { test, expect } from './support/fixtures'

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Partnerportál menü' })

test.describe('kiskereskedelem: több telephelyes lánc', () => {
  test('a számlalista szűrhető állapot szerint, a lejárt tartozás telephelyhez kötött', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-ADMIN').click()
    await page.getByTestId('company-DEMO-LANC').click()
    await nav(page).getByRole('link', { name: 'Számlák', exact: true }).click()

    await expect(page.getByTestId('invoice-summary')).toContainText('144 számla')
    await page.getByTestId('filter-status').selectOption('overdue')
    await expect(page.getByTestId('invoice-summary')).toContainText('1 számla')
    await expect(page.getByRole('row').filter({ hasText: 'Miskolc áruház' })).toHaveCount(1)
  })

  test('telephely szerint is szűrhető', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-ADMIN').click()
    await page.getByTestId('company-DEMO-LANC').click()
    await nav(page).getByRole('link', { name: 'Számlák', exact: true }).click()
    await page.getByTestId('filter-supply').selectOption('DEMO-LANC-G1')
    await expect(page.getByTestId('invoice-summary')).toContainText('12 számla')
  })

  test('a fogyasztási helyek oldalán havi fogyasztási grafikon látszik (12 hónap)', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'muszaki')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Fogyasztási helyek', exact: true }).click()
    const chart = page.getByTestId('consumption-chart')
    await expect(chart).toBeVisible()
    await expect(chart.locator('rect.bar')).toHaveCount(12)
    await expect(chart.getByRole('img')).toHaveAccessibleName(/Fogyasztás.*jan/)
    // a gáz télen sokszorosa a nyárinak
    await page.getByTestId('supply-select').selectOption(`${s.partnerId}-G1`)
    const heights = await chart.locator('rect.bar').evaluateAll(els => els.map(e => Number(e.getAttribute('height'))))
    expect(Math.max(...heights)).toBeGreaterThan(5 * Math.min(...heights.filter(h => h > 0)))
  })

  test('részletfizetési kérelem: a pénzügyi szerepkör indíthatja, díjcsomag-váltást nem', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'penzugy')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/ugyek/uj`)
    await expect(page.getByTestId('case-type').locator('option', { hasText: 'Díjcsomag-váltás' })).toHaveCount(0)
    await page.getByTestId('case-type').selectOption('reszletfizetes')
    await page.getByTestId('field-invoice').selectOption({ index: 0 })
    await page.getByTestId('field-months').fill('6')
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('Részletfizetési kérelem')
    const denied = await page.request.post(`/api/partner/${s.partnerId}/cases`, { data: { type: 'dijcsomag', fields: { supply: `${s.partnerId}-E1`, tariff: 'Piaci követő' } } })
    expect(denied.status()).toBe(403)
  })

  test('díjcsomag-váltás adminnal', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/ugyek/uj`)
    await page.getByTestId('case-type').selectOption('dijcsomag')
    await page.getByTestId('field-supply').selectOption(`${s.partnerId}-E1`)
    await page.getByTestId('field-tariff').fill('Piaci követő')
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('Piaci követő')
  })
})

test.describe('napelempark: termelői partner', () => {
  test('a termelő a Termelés és elszámolás oldalt látja, számlákat nem', async ({ page, erp }) => {
    const s = await erp.seed('napelempark', 'admin')
    await erp.login(page, s)
    await expect(nav(page).getByRole('link', { name: 'Számlák', exact: true })).toHaveCount(0)
    await expect(page.getByTestId('tile-invoices')).toHaveCount(0)
    await expect(page.getByTestId('tile-production')).toContainText('MWh')
    await nav(page).getByRole('link', { name: 'Termelés és elszámolás' }).click()

    // 20 MW park, ~1250 MWh/MW éves hozam: kb. 25 GWh
    const mwh = Number((await page.getByTestId('annual-mwh').innerText()).replace(/[^\d]/g, '').replace(/MWh$/, ''))
    expect(mwh).toBeGreaterThan(22_000)
    expect(mwh).toBeLessThan(28_000)
    await expect(page.getByTestId('production-chart').locator('rect.bar')).toHaveCount(12)
    await expect(page.locator('[data-testid^="production-"][data-testid$="202610"]')).toHaveCount(2)
  })

  test('szezonalitás: nyáron több, télen kevesebb a termelés', async ({ page, erp }) => {
    const s = await erp.seed('napelempark', 'olvaso')
    await erp.login(page, s)
    const res = await page.request.get(`/api/partner/${s.partnerId}/production`)
    const rows = await res.json() as { month: string, mwh: number }[]
    const by = (m: string) => rows.filter(r => r.month === m).reduce((a, r) => a + r.mwh, 0)
    expect(by('2026-07')).toBeGreaterThan(3 * by('2026-01'))
  })

  test('az elszámolás képlete: ár × MWh + prémium − kiegyenlítés', async ({ page, erp }) => {
    const s = await erp.seed('napelempark', 'penzugy')
    await erp.login(page, s)
    const rows = await (await page.request.get(`/api/partner/${s.partnerId}/production`)).json() as { mwh: number, priceHufPerMwh: number, premiumHuf: number, imbalanceHuf: number, settlementHuf: number }[]
    for (const r of rows) {
      expect(Math.abs(r.settlementHuf - (Math.round(r.mwh * r.priceHufPerMwh) + r.premiumHuf - r.imbalanceHuf))).toBeLessThanOrEqual(1)
    }
  })

  test('leállás-bejelentés: műszaki indíthatja, pénzügyi nem; az olvasó csak néz', async ({ page, erp }) => {
    const tech = await erp.seed('napelempark', 'muszaki')
    await erp.login(page, tech)
    await page.goto(`/partner/${tech.partnerId}/ugyek/uj`)
    await page.getByTestId('case-type').selectOption('leallas-bejelentes')
    await page.getByTestId('field-supply').selectOption(`${tech.partnerId}-T1`)
    await page.getByTestId('field-from').fill('2026-12-01')
    await page.getByTestId('field-reason').fill('Inverter csere')
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('Inverter csere')

    const fin = await erp.seed('napelempark', 'penzugy')
    await erp.login(page, fin)
    const res = await page.request.post(`/api/partner/${fin.partnerId}/cases`, { data: { type: 'leallas-bejelentes', fields: { supply: `${fin.partnerId}-T1`, from: '2026-12-01', reason: 'x' } } })
    expect(res.status()).toBe(403)

    const ro = await erp.seed('napelempark', 'olvaso')
    await erp.login(page, ro)
    await expect(page.getByTestId('tile-production')).toBeVisible()
    expect((await page.request.post(`/api/partner/${ro.partnerId}/cases`, { data: { type: 'kapacitas-modositas', fields: { supply: `${ro.partnerId}-T1`, newCapacityKw: '9000' } } })).status()).toBe(403)
  })

  test('a termelési adat cégenként elkülönül', async ({ page, erp }) => {
    const a = await erp.seed('napelempark', 'admin')
    const b = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, b)
    expect((await page.request.get(`/api/partner/${a.partnerId}/production`)).status()).toBe(403)
  })

  test('a demó termelő felhasználó belép, és a termelő nézetet kapja', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-TERMELO').click()
    await expect(page).toHaveURL(/\/partner\/DEMO-NAPELEM$/)
    await expect(page.getByTestId('company-name')).toHaveText('Alföldi Napenergia Kft.')
  })
})
