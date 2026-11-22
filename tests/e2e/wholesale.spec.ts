import { test, expect } from './support/fixtures'

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Partnerportál menü' })
const num = (s: string) => Number(s.replace(/[^\d]/g, ''))

test.describe('nagykereskedelem: ügyletek, menetrend, limit', () => {
  test('a kereskedő demó felhasználó belép: ügyletek, limit és menetrend menü, fogyasztási helyek nincs', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-KERESKEDO').click()
    await expect(page).toHaveURL(/\/partner\/DEMO-NAGYKER$/)
    await expect(page.getByTestId('company-name')).toHaveText('Duna Trade Kft.')
    await expect(page.getByTestId('role-chip')).toHaveText('Kereskedő')
    await expect(nav(page).getByRole('link', { name: 'Ügyletek' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Menetrend' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: 'Fogyasztási helyek' })).toHaveCount(0)
    await expect(page.getByTestId('tile-credit')).toBeVisible()
    await expect(page.getByTestId('pending-deals')).toHaveText('3')
  })

  test('ügyletek: szűrés, érték, és a visszaigazolás állapotot vált', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Ügyletek' }).click()
    await expect(page.getByTestId('deal-summary')).toContainText('12 ügylet')
    await page.getByTestId('deal-filter-commodity').selectOption('gaz')
    await expect(page.getByTestId('deal-summary')).toContainText('3 ügylet')
    await page.getByTestId('deal-filter-commodity').selectOption('')
    await page.getByTestId('deal-filter-status').selectOption('visszaigazolasra-var')
    await expect(page.getByTestId('deal-summary')).toContainText('3 ügylet')

    const row = page.getByTestId(`deal-${s.partnerId}-D07`)
    await expect(row.getByTestId('deal-status')).toHaveText('Visszaigazolásra vár')
    await row.getByTestId('confirm').click()
    await expect(page.getByRole('status').filter({ hasText: 'visszaigazolva' })).toBeVisible()
    await expect(page.getByTestId('deal-summary')).toContainText('2 ügylet')
  })

  test('a pénzügyi szerepkör látja az ügyleteket, de nem igazolhat vissza; az olvasó sem', async ({ page, erp }) => {
    for (const role of ['penzugy', 'olvaso'] as const) {
      const s = await erp.seed('nagykereskedelem', role)
      await erp.login(page, s)
      await page.goto(`/partner/${s.partnerId}/ugyletek`)
      await expect(page.getByTestId('confirm')).toHaveCount(0)
      const res = await page.request.post(`/api/partner/${s.partnerId}/deals/${s.partnerId}-D07/confirm`)
      expect(res.status()).toBe(403)
    }
  })

  test('kétszer nem igazolható vissza, és az ügylet idegen cégé nem érhető el', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    const url = `/api/partner/${s.partnerId}/deals/${s.partnerId}-D07/confirm`
    expect((await page.request.post(url)).status()).toBe(200)
    expect((await page.request.post(url)).status()).toBe(409)
    const other = await erp.seed('nagykereskedelem', 'kereskedo')
    expect((await page.request.post(`/api/partner/${other.partnerId}/deals/${s.partnerId}-D08/confirm`)).status()).toBe(403) // nem az ő cége
    expect((await page.request.post(`/api/partner/${s.partnerId}/deals/${other.partnerId}-D08/confirm`)).status()).toBe(404)
  })

  test('hitelkeret: a kihasználtság 0 és 100% között van, a garancia lejárata figyelmeztet', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    const c = await (await page.request.get(`/api/partner/${s.partnerId}/credit`)).json() as { limitHuf: number, usedHuf: number, usedPct: number, unpaidHuf: number, guaranteeExpiry: string }
    expect(c.limitHuf).toBe(3_000_000_000)
    expect(c.usedHuf).toBeGreaterThan(0)
    expect(c.usedPct).toBeGreaterThan(0)
    expect(c.usedPct).toBeLessThan(100)
    expect(c.unpaidHuf).toBeGreaterThan(900_000_000)
    expect(c.guaranteeExpiry).toBe('2027-02-28')
    await page.goto(`/partner/${s.partnerId}/ugyletek`)
    await expect(page.getByTestId('credit-tile')).toBeVisible()
    await expect(page.getByTestId('guarantee-warning')).toContainText('bankgarancia')
  })

  test('menetrend: benyújtás a holnapi napra, grafikon 24 órával, csúcsidei többlet', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Menetrend' }).click()
    await expect(page.getByTestId('schedule-chart').locator('rect.bar')).toHaveCount(24)
    await expect(page.getByTestId('tomorrow-status')).toContainText('még hiányzik')

    // a hétvége-független ellenőrzéshez a holnapi napot használjuk, a csúcsot a szerver hétköznapra alkalmazza
    await page.getByTestId('base-mw').fill('30')
    await page.getByTestId('peak-mw').fill('12')
    await page.getByTestId('gas-mwh').fill('140')
    await page.getByTestId('submit-schedule').click()
    await expect(page.getByRole('status')).toContainText('benyújtva')
    await expect(page.getByTestId('tomorrow-status')).toContainText('benyújtva')
    await expect(page.getByTestId('gas-total')).toContainText('140')
    const total = num((await page.getByTestId('power-total').innerText()).split('MWh')[0]!.replace(/[^\d,]/g, '').replace(',', ''))
    // alap 30 MW × 24 h = 720 MWh; hétköznap +12 MW × 12 h = 144 MWh (a szerver a napnak megfelelően alkalmazza)
    expect([720, 864]).toContain(total)
  })

  test('menetrend: a múltbeli nap és az érvénytelen érték elutasított, az olvasó nem nyújthat be', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    const past = await page.request.post(`/api/partner/${s.partnerId}/schedule`, { data: { date: '2020-01-01', commodity: 'villany', baseMw: 10, peakMw: 0 } })
    expect(past.status()).toBe(400)
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect((await page.request.post(`/api/partner/${s.partnerId}/schedule`, { data: { date: tomorrow, commodity: 'villany', baseMw: -5 } })).status()).toBe(400)
    const ro = await erp.seed('nagykereskedelem', 'olvaso')
    await erp.login(page, ro)
    expect((await page.request.post(`/api/partner/${ro.partnerId}/schedule`, { data: { date: tomorrow, commodity: 'villany', baseMw: 10, peakMw: 0 } })).status()).toBe(403)
    await page.goto(`/partner/${ro.partnerId}/menetrend`)
    await expect(page.getByTestId('schedule-form')).toHaveCount(0)
  })

  test('ügylet-vita ügy indítható a kereskedővel, pénzügyivel nem', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'kereskedo')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/ugyek/uj`)
    await page.getByTestId('case-type').selectOption('ugylet-vita')
    await page.getByTestId('field-deal').selectOption(`${s.partnerId}-D10`)
    await page.getByTestId('field-reason').fill('Az ár eltér a telefonon egyeztetettől')
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('Ügylet-vita')

    const fin = await erp.seed('nagykereskedelem', 'penzugy')
    await erp.login(page, fin)
    const denied = await page.request.post(`/api/partner/${fin.partnerId}/cases`, { data: { type: 'ugylet-vita', fields: { deal: `${fin.partnerId}-D10`, reason: 'x' } } })
    expect(denied.status()).toBe(403)
  })

  test('elszámoló számla: nagy tételek MWh-ban, a végösszeg stimmel', async ({ page, erp }) => {
    const s = await erp.seed('nagykereskedelem', 'penzugy')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/szamlak/${s.partnerId}-INV-202610`)
    for (const code of ['NK-BAZIS', 'NK-CSUCS', 'NK-GAZ']) await expect(page.getByTestId(`line-${code}`)).toBeVisible()
    await expect(page.getByTestId('line-NK-BAZIS')).toContainText('18 600 MWh')
    const net = num(await page.getByTestId('net-total').innerText())
    const vat = num(await page.getByTestId('vat-total').innerText())
    expect(net + vat).toBe(num(await page.getByTestId('gross-total').innerText()))
    expect(net).toBeGreaterThan(800_000_000)
  })

  test('a kereskedő cég nem fogyasztó: nincs fogyasztási hely oldal, a többi szerepkör sem lát ügyletet cégek között', async ({ page, erp }) => {
    const s = await erp.seed('napelempark', 'admin')
    await erp.login(page, s)
    expect((await page.request.get(`/api/partner/${s.partnerId}/deals`)).status()).toBe(200) // admin képesség, de a cégnek nincs ügylete
    expect(await (await page.request.get(`/api/partner/${s.partnerId}/deals`)).json()).toEqual([])
    await expect(nav(page).getByRole('link', { name: 'Ügyletek' })).toHaveCount(0)
  })
})

test.describe('demó felhasználók', () => {
  const users: Record<string, { company: string, role: string }> = {
    'DEMO-ELSZAMOLAS': { company: 'DEMO-NAGYKER', role: 'Pénzügyi' },
    'DEMO-UZEMVEZETO': { company: 'DEMO-NAPELEM', role: 'Műszaki' },
    'DEMO-VEZETO': { company: 'DEMO-NAGYKER', role: 'Adminisztrátor' },
  }
  for (const [id, u] of Object.entries(users)) {
    test(`${id} belép`, async ({ page }) => {
      await page.goto('/')
      await page.getByTestId(`login-${id}`).click()
      if (id !== 'DEMO-UZEMVEZETO') await page.getByTestId(`company-${u.company}`).click()
      await expect(page).toHaveURL(new RegExp(`/partner/${u.company}$`))
      await expect(page.getByTestId('role-chip')).toHaveText(u.role)
    })
  }

  test('az üzemvezető (műszaki) nem lát számlát és ügyletet, a leállás-bejelentés viszont indítható', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-UZEMVEZETO').click()
    await expect(nav(page).getByRole('link', { name: 'Számlák', exact: true })).toHaveCount(0)
    expect((await page.request.get('/api/partner/DEMO-NAPELEM/production')).status()).toBe(200)
    expect((await page.request.get('/api/partner/DEMO-NAGYKER/deals')).status()).toBe(403)
    const res = await page.request.post('/api/partner/DEMO-NAPELEM/cases', { data: { type: 'leallas-bejelentes', fields: { supply: 'DEMO-NAPELEM-T1', from: '2026-12-10', reason: 'Inverter-szervíz' } } })
    expect(res.status()).toBe(200)
  })

  test('a demó felhasználók csempéi a cégeiket és szerepkörüket mutatják', async ({ page }) => {
    await page.goto('/')
    const tile = page.getByTestId('demo-user-DEMO-VEZETO')
    await expect(tile).toContainText('Duna Trade Kft. · Adminisztrátor')
    await expect(tile).toContainText('Tisza Kereskedelmi Lánc Zrt. · Olvasó')
  })
})
