import { test, expect } from './support/fixtures'

// Az elfogadási feltétel light módra vonatkozik.
test.use({ colorScheme: 'light' })

test('a főoldali Belépés gomb zöld hátterű, fehér felirattal', async ({ page }) => {
  await page.goto('/')

  const login = page.getByRole('button', { name: 'Belépés' })
  await expect(login).toHaveCSS('background-color', 'rgb(43, 138, 62)')
  await expect(login).toHaveCSS('color', 'rgb(255, 255, 255)')
})

test('a Belépés gomb érvényes ügyfélazonosítóval a fiók oldalra navigál', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')

  await page.goto('/')
  await page.getByLabel('Ügyfélazonosító').fill(id)
  await page.getByRole('button', { name: 'Belépés' }).click()

  await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
  await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
})

test('a fizetés gomb háttérszíne nem változik', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  const pay = page.getByRole('button', { name: 'Fizetés' }).first()
  await expect(pay).toHaveCSS('background-color', 'rgb(232, 89, 12)')
})
