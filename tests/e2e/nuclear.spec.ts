import { test, expect } from './support/fixtures'

const nav = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Partnerportál menü' })
const num = (s: string) => Number(s.replace(/[^\d]/g, ''))

test.describe('Paks-jellegű bázistermelő: termelés és leállások', () => {
  test('4 blokk × 500 MW, éves termelés ~15–16 TWh, kihasználtság és leállási hónapok', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'admin')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Termelés és elszámolás' }).click()
    const mwh = num(await page.getByTestId('annual-mwh').innerText())
    expect(mwh).toBeGreaterThan(14_000_000)
    expect(mwh).toBeLessThan(17_000_000)
    // az 1-es blokk áprilisában (22 nap leállás) jóval kisebb a kihasználtság, mint egy normál hónapban
    const rows = await page.request.get(`/api/partner/${s.partnerId}/production`)
    const all = await rows.json() as { supplyPointId: string, month: string, mwh: number }[]
    const b1 = (m: string) => all.find(r => r.supplyPointId === `${s.partnerId}-T1` && r.month === m)!.mwh
    expect(b1('2026-04')).toBeLessThan(b1('2026-02') * 0.5)
    expect(b1('2026-02')).toBeGreaterThan(300_000)
    await expect(page.getByTestId(`production-${s.partnerId}-T1-202602`)).toContainText('9')
  })

  test('a leállási terv idővonala mutatja a blokkokat és a leállásokat', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'muszaki')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Leállások' }).click()
    await expect(page.getByTestId('outage-timeline')).toBeVisible()
    await expect(page.getByTestId(`bar-${s.partnerId}-OUT-05`)).toBeVisible()
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-05`)).toContainText('1/2')
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`)).toContainText('0/2')
  })

  test('az üzemvezető (műszaki) javasolhat, de jóváhagyni nem tud', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'muszaki')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/leallasok`)
    await expect(page.getByTestId('approve-outage')).toHaveCount(0)
    await page.getByTestId('outage-from').fill('2027-10-01')
    await page.getByTestId('outage-to').fill('2027-10-05')
    await page.getByTestId('outage-purpose').fill('Turbina-szervíz')
    await page.getByTestId('propose-outage').click()
    await expect(page.getByTestId('outage-message')).toContainText('jóváhagyásra vár')
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-09`)).toContainText('0/2')
    expect((await page.request.post(`/api/partner/${s.partnerId}/outages/${s.partnerId}-OUT-09/approve`)).status()).toBe(403)
  })

  test('érvénytelen javaslat elutasítva: múltbeli kezdet, fordított időszak, ismeretlen blokk', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'muszaki')
    await erp.login(page, s)
    const post = (data: object) => page.request.post(`/api/partner/${s.partnerId}/outages`, { data: { supplyPointId: `${s.partnerId}-T1`, kind: 'tervezett', from: '2027-11-01', to: '2027-11-05', purpose: 'x', ...data } })
    expect((await post({ from: '2020-01-01', to: '2020-01-05' })).status()).toBe(400)
    expect((await post({ from: '2027-11-10', to: '2027-11-05' })).status()).toBe(400)
    expect((await post({ supplyPointId: 'NINCS' })).status()).toBe(400)
    expect((await post({ purpose: '  ' })).status()).toBe(400)
    expect((await post({})).status()).toBe(200)
  })
})

test.describe('négy szem elve', () => {
  test('a leállás két KÜLÖNBÖZŐ jóváhagyó után lép életbe, ugyanaz kétszer nem jó, a javaslattevő a sajátját nem hagyhatja jóvá', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'admin', ['megfelelo'])
    const second = { userId: s.extra.megfelelo!, partnerId: s.partnerId, extra: {} }
    await erp.login(page, s)
    const url = `/api/partner/${s.partnerId}/outages/${s.partnerId}-OUT-06/approve`

    // 1. jóváhagyás az adminnal (a javaslattevő az üzemvezető volt)
    await page.goto(`/partner/${s.partnerId}/leallasok`)
    await page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('approve-outage').click()
    await expect(page.getByTestId('outage-message')).toContainText('1/2')
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`)).toContainText('1/2')
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('outage-status')).toHaveText('Jóváhagyásra vár')
    // ugyanaz a személy másodszor: nincs gomb és az API is tiltja
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('approve-outage')).toHaveCount(0)
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('approve-blocked')).toContainText('már jóváhagyta')
    const again = await page.request.post(url)
    expect(again.status()).toBe(409)
    expect((await again.json()).message).toContain('négy szem')

    // 2. jóváhagyás egy másik személlyel: véglegessé válik
    await erp.login(page, second)
    await page.goto(`/partner/${s.partnerId}/leallasok`)
    await page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('approve-outage').click()
    await expect(page.getByTestId('outage-message')).toContainText('jóváhagyva (2/2)')
    await expect(page.getByTestId(`outage-${s.partnerId}-OUT-06`).getByTestId('outage-status')).toHaveText('Jóváhagyva')
    expect((await page.request.post(url)).status()).toBe(409) // már jóvá van hagyva
  })

  test('a nagy összegű elszámolás két jóváhagyóval válik jóváhagyottá', async ({ page, erp }) => {
    // a szeptember már jóváhagyott; az októberi egy jóváhagyással vár (Szűcs Réka); a második a megfelelő/admin
    const s = await erp.seed('atomeromu', 'admin', ['megfelelo'])
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/termeles`)
    const card = page.getByTestId('awaiting-2026-10')
    await expect(card).toContainText('Szűcs Réka')
    await card.getByTestId('approve-settlement').click()
    await expect(page.getByTestId('settlement-message')).toContainText('rögzítve')
    await expect(page.getByTestId('approvals-card')).toHaveCount(0) // a 2. jóváhagyás után nem vár tovább

    const recs = await (await page.request.get(`/api/partner/${s.partnerId}/production`)).json() as { month: string, status: string }[]
    expect(recs.filter(r => r.month === '2026-10').every(r => r.status === 'jovahagyva')).toBe(true)
  })

  test('elszámolást a szerepkör nélküli (műszaki) nem hagyhat jóvá, kétszer ugyanaz sem', async ({ page, erp }) => {
    const tech = await erp.seed('atomeromu', 'muszaki')
    await erp.login(page, tech)
    await page.goto(`/partner/${tech.partnerId}/termeles`)
    await expect(page.getByTestId('approve-settlement')).toHaveCount(0)
    expect((await page.request.post(`/api/partner/${tech.partnerId}/settlements/approve`, { data: { month: '2026-10' } })).status()).toBe(403)

    const fin = await erp.seed('atomeromu', 'admin')
    await erp.login(page, fin)
    expect((await page.request.post(`/api/partner/${fin.partnerId}/settlements/approve`, { data: { month: '2026-10' } })).status()).toBe(200)
    const again = await page.request.post(`/api/partner/${fin.partnerId}/settlements/approve`, { data: { month: '2026-10' } })
    expect(again.status()).toBe(404) // a hónap jóvá van hagyva, nincs több függő
  })
})

test.describe('auditnapló és megfelelőség', () => {
  test('a megfelelőségi felelős látja a naplót, a jóváhagyás naplózódik; a műszaki nem látja', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'megfelelo')
    await erp.login(page, s)
    await nav(page).getByRole('link', { name: 'Napló' }).click()
    await expect(page.getByTestId('audit-count')).toContainText('bejegyzés')
    await expect(page.getByTestId('audit-row').first()).toBeVisible()
    await page.getByTestId('audit-search').fill('jóváhagyva')
    await expect(page.getByTestId('audit-row').first()).toContainText('jóváhagyva')

    // új jóváhagyás után megjelenik
    await page.request.post(`/api/partner/${s.partnerId}/outages/${s.partnerId}-OUT-06/approve`)
    await page.reload()
    await page.getByTestId('audit-search').fill(`${s.partnerId}-OUT-06`)
    await expect(page.getByTestId('audit-row').first()).toContainText('leállás jóváhagyva (1/2)')

    const tech = await erp.seed('atomeromu', 'muszaki')
    await erp.login(page, tech)
    expect((await page.request.get(`/api/partner/${tech.partnerId}/audit`)).status()).toBe(403)
    await expect(nav(page).getByRole('link', { name: 'Napló' })).toHaveCount(0)
  })

  test('a megfelelőségi szerepkör nem módosíthat mást: nem javasolhat leállást, nem indíthat ügyet, nem fizet', async ({ page, erp }) => {
    const s = await erp.seed('atomeromu', 'megfelelo')
    await erp.login(page, s)
    expect((await page.request.post(`/api/partner/${s.partnerId}/outages`, { data: { supplyPointId: `${s.partnerId}-T1`, kind: 'tervezett', from: '2027-11-01', to: '2027-11-02', purpose: 'x' } })).status()).toBe(403)
    expect((await page.request.post(`/api/partner/${s.partnerId}/cases`, { data: { type: 'tartozasigazolas', fields: { purpose: 'x' } } })).status()).toBe(403)
    await page.goto(`/partner/${s.partnerId}/leallasok`)
    await expect(page.getByTestId('propose-form')).toHaveCount(0)
  })
})

test.describe('Paks-jellegű demó felhasználók', () => {
  test('DEMO-ATOMVEZETO: jóváhagyhat; DEMO-ATOMUZEM: csak javasolhat; DEMO-MEGFELELO: napló és jóváhagyás', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-ATOMUZEM').click()
    await expect(page).toHaveURL(/\/partner\/DEMO-ATOM$/)
    await expect(page.getByTestId('company-name')).toHaveText('Dunai Atomerőmű Zrt.')
    await expect(page.getByTestId('role-chip')).toHaveText('Műszaki')
    await expect(page.getByTestId('pending-outages')).toHaveText('3')
    await expect(nav(page).getByRole('link', { name: 'Napló' })).toHaveCount(0)

    await page.getByTestId('logout').click()
    await page.getByTestId('login-DEMO-MEGFELELO').click()
    await expect(page.getByTestId('role-chip')).toHaveText('Megfelelőségi felelős')
    await expect(nav(page).getByRole('link', { name: 'Napló' })).toBeVisible()
  })
})
