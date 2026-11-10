import { test, expect } from './support/fixtures'

// A szemantikai színek értékei a main.css-ből; ezeknek változatlannak kell maradniuk.
const OK_LIGHT = 'rgb(43, 138, 62)'
const OK_DARK = 'rgb(105, 219, 124)'
const ERR_LIGHT = 'rgb(201, 42, 42)'
const ERR_DARK = 'rgb(255, 135, 135)'

/** A CSS-változó tényleges, kiszámított színét adja vissza. */
async function resolveVar(page: import('@playwright/test').Page, name: string) {
  return page.evaluate((varName) => {
    const el = document.createElement('div')
    el.style.color = `var(${varName})`
    document.body.append(el)
    const color = getComputedStyle(el).color
    el.remove()
    return color
  }, name)
}

test('a --brand light módban zöld, dark módban világos zöld', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await resolveVar(page, '--brand')).toBe(OK_LIGHT)

  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await resolveVar(page, '--brand')).toBe(OK_DARK)
})

test('a Belépés gomb a #20 szerint piros marad, nem örökli a zöld brand színt', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')

  const login = page.getByRole('button', { name: 'Belépés' })
  await expect(login).toHaveCSS('background-color', ERR_LIGHT)
  await expect(login).toHaveCSS('color', 'rgb(255, 255, 255)')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(login).toHaveCSS('background-color', ERR_DARK)
})

test('a --ok és --err szemantikai színek nem változnak', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  expect(await resolveVar(page, '--ok')).toBe(OK_LIGHT)
  expect(await resolveVar(page, '--err')).toBe(ERR_LIGHT)

  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await resolveVar(page, '--ok')).toBe(OK_DARK)
  expect(await resolveVar(page, '--err')).toBe(ERR_DARK)
})

test('a számlaállapotok szemantikai színei megmaradnak', async ({ page, sap }) => {
  const id = await sap.seed('elmaradt-szamla')
  await page.goto(`/fiok/${id}`)

  await expect(page.getByTestId('bill-status').first()).toHaveCSS('color', ERR_LIGHT)
})
