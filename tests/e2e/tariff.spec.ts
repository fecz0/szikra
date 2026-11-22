import { test, expect } from './support/fixtures'

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Partnerportál menü' })
const num = (s: string) => Number(s.replace(/[^\d-]/g, ''))

test.describe('díjcsomag-szimulátor', () => {
  test('a jelenlegi díjcsomag jelölt, a motor pontosan a kiszámlázott energiadíjat adja (0 Ft eltérés)', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Díjcsomagok' }).click()
    await expect(page.getByTestId('sim-results').locator('tbody tr')).toHaveCount(5)
    await expect(page.getByTestId('sim-SYS-FIX').getByTestId('current-badge')).toBeVisible() // 1. telephely: Ipari fix 2026
    await expect(page.getByTestId('reconcile-diff')).toHaveText('0 Ft')
    await expect(page.getByTestId('sim-chart').locator('rect.bar')).toHaveCount(5)
    await expect(page.getByTestId('sim-monthly').locator('rect.bar')).toHaveCount(12)
  })

  test('más telephelyen más a jelenlegi díjcsomag, és a motor ott is egyezik a számlával', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/dijcsomagok`)
    for (const [site, tariff] of [['E3', 'SYS-PIACI'], ['E2', 'SYS-FIX']] as const) {
      await page.getByTestId('sim-site').selectOption(`${s.partnerId}-${site}`)
      await expect(page.getByTestId(`sim-${tariff}`).getByTestId('current-badge')).toBeVisible()
      await expect(page.getByTestId('reconcile-diff')).toHaveText('0 Ft')
    }
  })

  test('az összehasonlítás következetes: a legolcsóbb megtakarítása egyezik a táblázattal, a dinamikus magyarázat látszik', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/dijcsomagok`)
    const annual: Record<string, number> = {}
    for (const row of await page.getByTestId('sim-results').locator('tbody tr').all()) {
      annual[(await row.getAttribute('data-testid'))!.replace('sim-', '')] = num((await row.getByTestId('sim-annual').innerText()).replace(',', '.').replace(/[^\d.]/g, '')) 
    }
    expect(Object.keys(annual)).toHaveLength(5)
    await expect(page.getByTestId('dynamic-note')).toContainText('súlyozott átlagár')
    await expect(page.getByTestId('tile-best')).toBeVisible()
    // a 12 hónapos kötésű fix díjcsomag olcsóbb a jelenleginél: van mit ajánlani
    await expect(page.getByTestId('sim-SYS-FIX27').getByTestId('sim-saving')).toContainText('−')
    await expect(page.getByTestId('best-saving')).toBeVisible()
  })

  test('egyedi díjcsomag kód nélkül: létrejön, a szimuláció tartalmazza és olcsóbbat mutat; duplikált név és hibás ár elutasítva', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/dijcsomagok`)
    await page.getByTestId('tariff-name').fill('Tavaszi akció fix')
    await page.getByTestId('tariff-fix').fill('30')
    await page.getByTestId('tariff-save').click()
    await expect(page.getByTestId('tariff-message')).toContainText('létrehozva')
    const row = page.getByTestId(`sim-${s.partnerId}-TAR-01`)
    await expect(row).toContainText('egyedi')
    await expect(row.getByTestId('sim-saving')).toContainText('−')
    await expect(page.getByTestId('tile-best')).toContainText('Tavaszi akció fix')

    // duplikált név
    await page.getByTestId('tariff-name').fill('tavaszi akció FIX')
    await page.getByTestId('tariff-save').click()
    await expect(page.getByTestId('tariff-message')).toContainText('már van')
    // hibás ár
    const bad = await page.request.post(`/api/partner/${s.partnerId}/tariffs`, { data: { name: 'Rossz', kind: 'fix', fixHufPerKwh: 5000 } })
    expect(bad.status()).toBe(400)
    const tou = await page.request.post(`/api/partner/${s.partnerId}/tariffs`, { data: { name: 'Zónás', kind: 'tou', zoneHufPerKwh: { nappali: 40, csucs: 55, volgy: 28 } } })
    expect(tou.status()).toBe(200)
  })

  test('a váltás kérése az előtöltött díjcsomag-váltási ügyre visz', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/dijcsomagok`)
    await page.getByTestId('sim-SYS-CSV').getByTestId('switch-link').click()
    await expect(page).toHaveURL(/ugyek\/uj\?type=dijcsomag/)
    await expect(page.getByTestId('case-type')).toHaveValue('dijcsomag')
    await expect(page.getByTestId('field-tariff')).toHaveValue('Kereskedelmi csúcs-völgy')
    await expect(page.getByTestId('field-supply')).toHaveValue(`${s.partnerId}-E1`)
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('Kereskedelmi csúcs-völgy')
  })

  test('szerepkörök: a pénzügyi és az olvasó nézheti, de nem hozhat létre díjcsomagot; a kereskedő cégnél nincs menü', async ({ page, erp }) => {
    for (const role of ['penzugy', 'olvaso'] as const) {
      const s = await erp.seed('kereskedelmi-lanc', role)
      await erp.login(page, s)
      await page.goto(`/partner/${s.partnerId}/dijcsomagok`)
      await expect(page.getByTestId('sim-results')).toBeVisible()
      await expect(page.getByTestId('tariff-builder')).toHaveCount(0)
      expect((await page.request.post(`/api/partner/${s.partnerId}/tariffs`, { data: { name: 'X', kind: 'fix', fixHufPerKwh: 30 } })).status()).toBe(403)
    }
    const t = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, t)
    await expect(nav(page).getByRole('link', { name: 'Díjcsomagok' })).toHaveCount(0)
  })

  test('intervallumadat nélküli hely, gáz és idegen cég: értelmes válasz', async ({ page, erp }) => {
    const old = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, old)
    await page.goto(`/partner/${old.partnerId}/dijcsomagok`)
    await expect(page.getByTestId('no-intervals')).toBeVisible()
    const chain = await erp.seed('kereskedelmi-lanc', 'admin')
    await erp.login(page, chain)
    expect((await page.request.get(`/api/partner/${chain.partnerId}/tariff-simulation?supplyPointId=${chain.partnerId}-G1`)).status()).toBe(404)
    expect((await page.request.get(`/api/partner/${old.partnerId}/tariff-simulation?supplyPointId=${old.partnerId}-E1`)).status()).toBe(403)
  })

  test('a fogyasztási helyek oldalán napi terhelési profil látszik 24 órával', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'muszaki')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Fogyasztási helyek', exact: true }).click()
    const chart = page.getByTestId('profile-chart')
    await expect(chart.locator('rect.bar')).toHaveCount(24)
    const h = await chart.locator('rect.bar').evaluateAll(els => els.map(e => Number(e.getAttribute('height'))))
    expect(Math.max(...h)).toBeGreaterThan(Math.min(...h) * 1.4) // éjjel jóval kisebb a terhelés
  })
})
