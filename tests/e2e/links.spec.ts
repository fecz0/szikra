import { test, expect } from './support/fixtures'

// A linkszín értékei a main.css-ből (--link).
const BRAND_LIGHT = 'rgb(0, 86, 126)'
const BRAND_DARK = 'rgb(108, 196, 238)'

test('a fejléc menüjének linkjei fehéres színűek, alapból aláhúzás nélkül', async ({ page }) => {
  await page.goto('/')

  const links = page.getByRole('navigation', { name: 'Főmenü' }).getByRole('link')
  await expect(links).toHaveCount(3)
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('text-decoration-line', 'none')
  }
})

test('a linkek hoverre aláhúzottá válnak', async ({ page }) => {
  await page.goto('/')

  const link = page.getByRole('navigation', { name: 'Főmenü' }).getByRole('link', { name: 'Tesztriport' })
  await expect(link).toHaveCSS('text-decoration-line', 'none')
  await link.hover()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
})

test('a cégválasztó oldal linkje link színű (dark módban világosabb kék)', async ({ page, erp }) => {
  const s = await erp.seed('okos-ipari', 'admin')
  await erp.login(page, s)
  await page.goto(`/partner/${s.partnerId}/ugyek`)

  const link = page.getByTestId('new-case')
  await expect(link).toHaveCSS('color', BRAND_LIGHT)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(link).toHaveCSS('color', BRAND_DARK)
})

test('a fejléc-logó fehér, az elsődleges gomb sötétkék (dark módban világosabb kék)', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('button', { name: 'Belépés', exact: true })).toHaveCSS('background-color', 'rgb(28, 43, 57)')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('button', { name: 'Belépés', exact: true })).toHaveCSS('background-color', 'rgb(42, 122, 166)')
})
