import { test, expect } from './support/fixtures'

// A Szikra megjelenése: sötétkék, átmenetes fejléc, sárga kiemelő sáv, lekerekített gombok.
// Márkanév-szabály: a "MVM" és az "omni" sehol nem szerepelhet, csak a "Szikra".
const NAVY = 'rgb(28, 43, 57)'
const YELLOW = 'rgb(240, 179, 35)'

test.use({ colorScheme: 'light' })

test('a fejléc sötétkék átmenetes, a logó SZIKRA, alatta a „Főoldal” cím', async ({ page }) => {
  await page.goto('/')

  const header = page.getByRole('banner')
  await expect(header).toBeVisible()
  expect(await header.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('gradient')

  const logo = page.getByTestId('brand-logo')
  expect(await logo.evaluate((el) => (el as HTMLElement).innerText.trim())).toBe('SZIKRA')
  await expect(logo).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByTestId('page-title')).toHaveText('Főoldal')
})

test('a fejléc menüje valódi linkeket tartalmaz', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Főmenü' })
  await expect(nav.getByRole('link')).toHaveCount(3)
  for (const link of await nav.getByRole('link').all()) {
    await expect(link).toHaveAttribute('href', /.+/)
  }
})

test('a főoldal hero részében cím, tájékoztató, belépés és sárga sáv van', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Szikra online ügyintézés')
  await expect(page.getByTestId('demo-notice')).toBeVisible()
  await expect(page.getByTestId('hero')).toHaveCSS('border-bottom-color', YELLOW)

  const login = page.getByRole('button', { name: 'Belépés' })
  await expect(login).toHaveCSS('background-color', NAVY)
  await expect(login).toHaveCSS('border-top-left-radius', '12px')
  await expect(login).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('a belépés a hero űrlapjából továbbra is működik', async ({ page, sap }) => {
  const id = await sap.seed('rendezett-szamlak')
  await page.goto('/')
  await page.getByLabel('Ügyfélazonosító').fill(id)
  await page.getByRole('button', { name: 'Belépés' }).click()
  await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
  await expect(page.getByTestId('page-title')).toHaveText('Ügyfélfiók')
})

test('a fiókoldal kártyái lekerekítettek, a Fizetés gomb sötétkék', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByTestId('customer-name').locator('xpath=ancestor::section[1]'))
    .toHaveCSS('border-top-left-radius', '12px')
  await expect(page.getByRole('button', { name: 'Fizetés' }).first()).toHaveCSS('background-color', NAVY)
})

test('sehol nem szerepel az „MVM” vagy az „omni” név (látható szöveg, cím, attribútumok)', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  for (const url of ['/', `/fiok/${id}`, '/fiok/NEMLETEZIK']) {
    await page.goto(url)
    const texts = await page.evaluate(() => [
      document.title,
      document.body.innerText,
      ...[...document.querySelectorAll('[aria-label],[alt],[title],[placeholder]')].flatMap((e) =>
        ['aria-label', 'alt', 'title', 'placeholder'].map((a) => e.getAttribute(a) ?? '')),
      ...[...document.querySelectorAll('meta[content]')].map((m) => m.getAttribute('content') ?? ''),
    ].join('\n'))
    expect(texts, `tiltott név ezen: ${url}`).not.toMatch(/mvm|omni/i)
  }
})

test('telefonos szélességen nincs vízszintes görgetés', async ({ page, sap }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  const id = await sap.seed('okosmero-gaz-villany')
  for (const url of ['/', `/fiok/${id}`]) {
    await page.goto(url)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `túlcsordulás ezen: ${url}`).toBeLessThanOrEqual(0)
  }
})
