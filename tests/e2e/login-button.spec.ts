import { test, expect } from './support/fixtures'

test.describe('belépés gomb', () => {
  test('a Belépés gomb piros, fehér felirattal', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    const login = page.getByRole('button', { name: 'Belépés' })
    await expect(login).toHaveCSS('background-color', 'rgb(201, 42, 42)')
    await expect(login).toHaveCSS('color', 'rgb(255, 255, 255)')
  })

  test('érvényes ügyfélazonosítóval a /fiok/ oldalra navigál', async ({ page, sap }) => {
    const id = await sap.seed('okosmero-gaz-villany')

    await page.goto('/')
    await page.getByLabel('Ügyfélazonosító').fill(id)
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
    await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
  })

  test('a fizetés gomb színe nem változik', async ({ page, sap }) => {
    const id = await sap.seed('okosmero-gaz-villany')

    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(`/fiok/${id}`)

    await expect(page.getByRole('button', { name: 'Fizetés' }).first())
      .toHaveCSS('background-color', 'rgb(232, 89, 12)')
  })
})
