import { test, expect } from './support/fixtures'

test.describe('belépés és cégválasztás', () => {
  test('a belépő oldal listázza a demó felhasználókat', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('demo-users').getByRole('button')).toHaveCount(4)
  })

  test('több cég: cégválasztó, majd a választott cég oldala', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-ADMIN').click()
    await expect(page).toHaveURL(/\/valasztas$/)
    await page.getByTestId('company-DEMO-KARTYA').click()
    await expect(page.getByTestId('company-name')).toHaveText('Pech Gázfogyasztó Bt.')
    await expect(page.getByTestId('role-chip')).toHaveText('Pénzügyi')
  })

  test('egy cég: nincs választó, egyből a cég oldalára visz', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-MUSZAKI').click()
    await expect(page).toHaveURL(/\/partner\/DEMO-OKOS$/)
  })

  test('belépés nélkül a partner oldal a főoldalra dob', async ({ page }) => {
    await page.goto('/partner/DEMO-OKOS')
    await expect(page).toHaveURL(/\/$/)
  })

  test('idegen cég oldalát nem látja a felhasználó', async ({ page, erp }) => {
    const s = await erp.seed('rendezett-szamlak', 'admin')
    await erp.login(page, s)
    const res = await page.request.get('/api/partner/DEMO-OKOS/invoices')
    expect(res.status()).toBe(403)
  })
})

test.describe('számlák és fizetés', () => {
  test('számla kifizetése; a másik számla érintetlen', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'penzugy')
    await erp.login(page, s)
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Számlák', exact: true }).click()

    const inv = page.getByTestId(`invoice-${s.partnerId}-INV1`)
    await expect(inv.getByTestId('invoice-status')).toHaveText('Nyitott')
    await inv.getByTestId('pay').click()
    await expect(page.getByRole('status')).toHaveText('Sikeres fizetés')
    await expect(inv.getByTestId('invoice-status')).toHaveText('Kiegyenlítve')
    await expect(page.getByTestId(`invoice-${s.partnerId}-INV2`).getByTestId('invoice-status')).toHaveText('Nyitott')
  })

  test('elutasított kártya: hibaüzenet, a számla nyitott marad', async ({ page, erp }) => {
    const s = await erp.seed('kartya-elutasitva', 'penzugy')
    await erp.login(page, s)
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Számlák', exact: true }).click()
    await page.getByTestId('pay').click()
    await expect(page.getByRole('alert')).toContainText('elutasította')
    await expect(page.getByTestId('invoice-status')).toHaveText('Nyitott')
  })

  test('olvasó szerepkörnek nincs Fizetés gomb, és az API is tiltja', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'olvaso')
    await erp.login(page, s)
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Számlák', exact: true }).click()
    await expect(page.getByTestId('pay')).toHaveCount(0)
    const res = await page.request.post(`/api/partner/${s.partnerId}/invoices/${s.partnerId}-INV1/pay`)
    expect(res.status()).toBe(403)
  })

  test('a nyitóoldal a tartozást összegzi', async ({ page, erp }) => {
    const s = await erp.seed('elmaradt-szamla', 'admin')
    await erp.login(page, s)
    await expect(page.getByTestId('tile-invoices')).toContainText('2 lejárt')
    await expect(page.getByTestId('outstanding')).toContainText('4 590 000')
  })
})

test.describe('szerepkör szerinti láthatóság', () => {
  test('a műszaki szerepkör nem lát számlát', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'muszaki')
    await erp.login(page, s)
    await expect(page.getByTestId('tile-invoices')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Számlák', exact: true })).toHaveCount(0)
    expect((await page.request.get(`/api/partner/${s.partnerId}/invoices`)).status()).toBe(403)
  })

  test('a fogyasztási helyek látszanak', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, s)
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Fogyasztási helyek', exact: true }).click()
    await expect(page.getByTestId('supply-villany')).toContainText('Okosmérő')
    await expect(page.getByTestId('supply-gaz')).toBeVisible()
  })
})

test.describe('ügyintézés (közös keretrendszer)', () => {
  test('számlareklamáció indítása és üzenet küldése', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'penzugy')
    await erp.login(page, s)
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Ügyeim', exact: true }).click()
    await page.getByTestId('new-case').click()
    await page.getByTestId('case-type').selectOption('szamlareklamacio')
    await page.getByTestId('field-invoice').selectOption(`${s.partnerId}-INV1`)
    await page.getByTestId('field-reason').fill('Az összeg túl magas')
    await page.getByTestId('submit-case').click()

    await expect(page.getByTestId('case-detail')).toBeVisible()
    await expect(page.getByTestId('case-status')).toHaveText('Új')
    await page.getByTestId('message-text').fill('Csatolom a mérőállást')
    await page.getByTestId('send-message').click()
    await expect(page.getByTestId('case-detail')).toContainText('Csatolom a mérőállást')
  })

  test('mérőállás közlése műszaki szerepkörrel; a pénzügyi nem indíthatja', async ({ page, erp }) => {
    const tech = await erp.seed('okos-ipari', 'muszaki')
    await erp.login(page, tech)
    await page.goto(`/partner/${tech.partnerId}/ugyek/uj`)
    await page.getByTestId('case-type').selectOption('meroallas')
    await page.getByTestId('field-supply').selectOption(`${tech.partnerId}-E1`)
    await page.getByTestId('field-reading').fill('48300')
    await page.getByTestId('submit-case').click()
    await expect(page.getByTestId('case-detail')).toContainText('48300')

    const fin = await erp.seed('okos-ipari', 'penzugy')
    await erp.login(page, fin)
    const res = await page.request.post(`/api/partner/${fin.partnerId}/cases`, { data: { type: 'meroallas', fields: { supply: `${fin.partnerId}-E1`, reading: '1' } } })
    expect(res.status()).toBe(403)
  })

  test('kötelező mező hiányában hibaüzenet', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/ugyek/uj`)
    await page.getByTestId('case-type').selectOption('tartozasigazolas')
    await page.getByTestId('submit-case').click()
    await expect(page.getByRole('alert')).toContainText('Kötelező mező')
  })

  test('a ügyek cégenként elkülönülnek', async ({ page, erp }) => {
    const a = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, a)
    const created = await (await page.request.post(`/api/partner/${a.partnerId}/cases`, { data: { type: 'tartozasigazolas', fields: { purpose: 'pályázat' } } })).json()
    const b = await erp.seed('okos-ipari', 'admin')
    await erp.login(page, b)
    expect((await page.request.get(`/api/partner/${b.partnerId}/cases/${created.id}`)).status()).toBe(404)
  })
})

test('health végpont él', async ({ request }) => {
  expect((await (await request.get('/api/health')).json()).status).toBe('ok')
})
