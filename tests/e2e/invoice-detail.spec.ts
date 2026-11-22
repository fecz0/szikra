import { test, expect } from './support/fixtures'

const num = (s: string) => Number(s.replace(/[^\d-]/g, ''))

async function openLanc(page: import('@playwright/test').Page, invoiceId: string) {
  await page.goto('/')
  await page.getByTestId('login-DEMO-ADMIN').click()
  await page.getByTestId('company-DEMO-LANC').click()
  await page.goto(`/partner/DEMO-LANC/szamlak/${invoiceId}`)
  await expect(page.getByTestId('invoice-detail')).toBeVisible()
}

test.describe('számlakép: tételes számla valós díjszerkezettel', () => {
  test('a számlalistából megnyitható a részletező', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-DEMO-ADMIN').click()
    await page.getByTestId('company-DEMO-LANC').click()
    await page.getByRole('navigation', { name: 'Partnerportál menü' }).getByRole('link', { name: 'Számlák', exact: true }).click()
    await page.getByTestId('open-DEMO-LANC-INV-E1-202610').click()
    await expect(page.getByTestId('invoice-id')).toHaveText('DEMO-LANC-INV-E1-202610')
  })

  test('villanyszámla (KIF III.): rendszerhasználati tételek, zónák, a végösszeg stimmel', async ({ page }) => {
    await openLanc(page, 'DEMO-LANC-INV-E1-202610')
    await expect(page.getByTestId('invoice-detail').getByRole('heading', { level: 1 })).toHaveText('Villamos energia elszámoló számla')
    await expect(page.getByTestId('network-category')).toHaveText('KIF III.')
    for (const code of ['RH-ATV', 'RH-ALAP', 'RH-TELJ', 'RH-FORG', 'PE-KAT', 'AD-JOV', 'EN-FIX']) await expect(page.getByTestId(`line-${code}`)).toBeVisible()
    // közzétett egységárak: átviteli 3,39; KIF III. forgalmi 22,20
    await expect(page.getByTestId('line-RH-ATV')).toContainText('3,39')
    await expect(page.getByTestId('line-RH-FORG')).toContainText('22,20')

    const net = num(await page.getByTestId('net-total').innerText())
    const vat = num(await page.getByTestId('vat-total').innerText())
    const gross = num(await page.getByTestId('gross-total').innerText())
    expect(net + vat).toBe(gross)
    expect(Math.abs(vat - Math.round(net * 0.27))).toBeLessThanOrEqual(1)
    const groups = await Promise.all(['energia', 'rendszerhasznalat', 'penzeszkoz-ado'].map(async g => num(await page.getByTestId(`group-${g}`).innerText())))
    expect(groups.reduce((a, b) => a + b, 0)).toBe(net)

    const zones = (await page.getByTestId('usage-zones').locator('tbody td').allInnerTexts()).map(num)
    expect(zones.reduce((a, b) => a + b, 0)).toBe(num(await page.getByTestId('usage-total').innerText()))
  })

  test('KIF IV. telephely: nincs lekötött teljesítménydíj', async ({ page }) => {
    await openLanc(page, 'DEMO-LANC-INV-E8-202610')
    await expect(page.getByTestId('network-category')).toHaveText('KIF IV.')
    await expect(page.getByTestId('line-RH-TELJ')).toHaveCount(0)
    await expect(page.getByTestId('line-RH-FORG')).toContainText('20,01')
  })

  test('tőzsdei követő díjcsomag: tőzsdei ár + kereskedői díj', async ({ page }) => {
    await openLanc(page, 'DEMO-LANC-INV-E3-202610')
    await expect(page.getByTestId('line-EN-HUPX')).toContainText('Tőzsdei energiaár')
    await expect(page.getByTestId('line-EN-MARZS')).toBeVisible()
  })

  test('csúcs-völgy díjcsomag: három energiasor zónánként', async ({ page }) => {
    await openLanc(page, 'DEMO-LANC-INV-E5-202610')
    for (const code of ['EN-NAP', 'EN-CSUCS', 'EN-VOLGY']) await expect(page.getByTestId(`line-${code}`)).toBeVisible()
  })

  test('gázszámla: kapacitás- és forgalmi díj, nincs zónabontás', async ({ page }) => {
    await openLanc(page, 'DEMO-LANC-INV-G1-202601')
    await expect(page.getByTestId('invoice-detail').getByRole('heading', { level: 1 })).toHaveText('Földgáz elszámoló számla')
    for (const code of ['GAZ-EN', 'GAZ-SZALL', 'GAZ-ELOSZT-FORG', 'GAZ-ELOSZT-KAP', 'GAZ-ELOSZT-ALAP']) await expect(page.getByTestId(`line-${code}`)).toBeVisible()
    await expect(page.getByTestId('usage-zones')).toHaveCount(0)
  })

  test('a régi, egysoros számlához nincs tételes bontás, de megnyílik', async ({ page, erp }) => {
    const s = await erp.seed('okos-ipari', 'penzugy')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/szamlak/${s.partnerId}-INV1`)
    await expect(page.getByTestId('lines-block')).toContainText('nem tartozik tételes bontás')
  })

  test('pénzügyi szerepkör megnyithatja, műszaki nem; idegen cég számláját senki', async ({ page, erp }) => {
    const fin = await erp.seed('kereskedelmi-lanc', 'penzugy')
    await erp.login(page, fin)
    expect((await page.request.get(`/api/partner/${fin.partnerId}/invoices/${fin.partnerId}-INV-E1-202610`)).status()).toBe(200)
    expect((await page.request.get(`/api/partner/DEMO-LANC/invoices/DEMO-LANC-INV-E1-202610`)).status()).toBe(403)
    const tech = await erp.seed('kereskedelmi-lanc', 'muszaki')
    await erp.login(page, tech)
    expect((await page.request.get(`/api/partner/${tech.partnerId}/invoices/${tech.partnerId}-INV-E1-202610`)).status()).toBe(403)
  })

  test('a nyitott számla a részletezőből is kifizethető, a nyomtatás gomb elérhető', async ({ page, erp }) => {
    const s = await erp.seed('kereskedelmi-lanc', 'penzugy')
    await erp.login(page, s)
    await page.goto(`/partner/${s.partnerId}/szamlak/${s.partnerId}-INV-E1-202610`)
    await expect(page.getByTestId('print')).toBeVisible()
    await expect(page.getByTestId('invoice-status')).toHaveText('Nyitott')
    await page.getByTestId('pay').click()
    await expect(page.getByTestId('invoice-status')).toHaveText('Kiegyenlítve')
  })
})
