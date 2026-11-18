import { test, expect } from './support/fixtures'

// A linkszín értékei a main.css-ből (--link).
const BRAND_LIGHT = 'rgb(0, 86, 126)'
const BRAND_DARK = 'rgb(108, 196, 238)'

test('a demó ügyféllista linkjei link színűek, alapból aláhúzás nélkül', async ({ page }) => {
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

test('a linkek dark módban a világosabb kék színt kapják', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const links = page.getByTestId('demo-users').getByRole('link')
  await expect(links).toHaveCount(4)
  for (const link of await links.all()) {
    await expect(link).toHaveCSS('color', BRAND_DARK)
  }
})

test('a Vissza a belépéshez link a fiókoldalon is link színű', async ({ page }) => {
  await page.goto('/fiok/NEMLETEZIK')

  const link = page.getByRole('link', { name: 'Vissza a belépéshez' })
  await expect(link).toHaveCSS('color', BRAND_LIGHT)
  await expect(link).toHaveCSS('text-decoration-line', 'none')
  await link.hover()
  await expect(link).toHaveCSS('text-decoration-line', 'underline')
})

test('a fejléc-logó fehér, az elsődleges gomb sötétkék (dark módban világosabb kék)', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('button', { name: 'Belépés' })).toHaveCSS('background-color', 'rgb(28, 43, 57)')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.getByRole('link', { name: /Szikra/ })).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(page.getByRole('button', { name: 'Belépés' })).toHaveCSS('background-color', 'rgb(42, 122, 166)')
})
