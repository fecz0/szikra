import { test, expect } from './support/fixtures'

// A --brand szín értékei a main.css-ből.
const BRAND_LIGHT = 'rgb(43, 138, 62)'
const BRAND_DARK = 'rgb(105, 219, 124)'

test('a demó ügyféllista linkjei zöldek, alapból aláhúzás nélkül', async ({ page }) => {
  await page.goto('/')

  const links = page.getByTestId('demo-users').getByRole('link')
  await expect(links).toHaveCount(4)
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', BRAND_LIGHT)
    await expect(link).toHaveCSS('text-decoration-line', 'none')
  }
})

test('a linkek hoverre aláhúzottá válnak', async ({ page }) => {
  await page.goto('/')

  const link = page.getByTestId('demo-users').getByRole('link', { name: 'Teszt Elek' })
  await expect(link).toHaveCSS('text-decoration-line', 'none')
  await link.hover()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
})

test('a linkek dark módban a világosabb zöld színt kapják', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const links = page.getByTestId('demo-users').getByRole('link')
  await expect(links).toHaveCount(4)
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', BRAND_DARK)
  }
})

test('a Vissza a belépéshez link a fiókoldalon is zöld', async ({ page }) => {
  await page.goto('/fiok/NEMLETEZIK')

  const link = page.getByRole('link', { name: 'Vissza a belépéshez' })
  await expect(link).toHaveCSS('color', BRAND_LIGHT)
  await expect(link).toHaveCSS('text-decoration-line', 'none')
  await link.hover()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
})

test('a fejléc-logó és az elsődleges gomb a márkaalapszínt kapja', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', BRAND_LIGHT)
  await expect(page.getByRole('button', { name: 'Fizetés' }).first()).toHaveCSS('background-color', BRAND_LIGHT)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', BRAND_DARK)
  await expect(page.getByRole('button', { name: 'Fizetés' }).first()).toHaveCSS('background-color', BRAND_DARK)
})
