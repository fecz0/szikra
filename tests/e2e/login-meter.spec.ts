import { test, expect } from './support/fixtures'

test.describe('belépés mérőóra ID-val', () => {
  test('két belépési mód látszik, az ügyfél-azonosító az alapértelmezett', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('login-method-customer')).toBeVisible()
    await expect(page.getByTestId('login-method-meter')).toBeVisible()
    await expect(page.getByLabel('Ügyfélazonosító')).toBeVisible()
    await expect(page.getByTestId('meter-id-input')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Belépés' })).toBeVisible()
  })

  test('ügyfél-azonosítóval a meglévő belépés változatlanul működik', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Ügyfélazonosító').fill('DEMO-OKOS')
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page).toHaveURL(/\/fiok\/DEMO-OKOS$/)
    await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
  })

  test('seedelt ügyfél mérőóra ID-jával ugyanabba a fiókba lép', async ({ page, sap }) => {
    const id = await sap.seed('okosmero-gaz-villany')

    await page.goto('/')
    await page.getByTestId('login-method-meter').click()
    await expect(page.getByLabel('Mérőóra ID')).toBeVisible()
    await page.getByTestId('meter-id-input').fill(`${id}-E1`)
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
    await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
  })

  test('demó ügyfél mérőóra ID-val is elérhető', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-method-meter').click()
    await page.getByTestId('meter-id-input').fill('DEMO-OKOS-E1')
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page).toHaveURL(/\/fiok\/DEMO-OKOS$/)
    await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
  })

  test('üres mérőóra ID: hibaüzenet, a belépés nem történik meg', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-method-meter').click()
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page.getByRole('alert')).toHaveText('Add meg a mérőóra ID-t.')
    await expect(page).toHaveURL(/\/$/)
  })

  test('ismeretlen mérőóra ID: hibaüzenet, a belépés nem történik meg', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('login-method-meter').click()
    await page.getByTestId('meter-id-input').fill('NINCS-ILYEN-MERO')
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page.getByRole('alert')).toHaveText('Nem található ügyfél ehhez a mérőóra ID-hoz.')
    await expect(page).toHaveURL(/\/$/)
  })

  test('módváltáskor az űrlap állapota tiszta, a belépés gomb felirata Belépés', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Ügyfélazonosító').fill('DEMO-OKOS')
    await page.getByTestId('login-method-meter').click()
    await expect(page.getByTestId('meter-id-input')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Belépés' })).toBeVisible()

    await page.getByTestId('meter-id-input').fill('DEMO-OKOS-E1')
    await page.getByTestId('login-method-customer').click()
    await expect(page.getByLabel('Ügyfélazonosító')).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Belépés' })).toBeVisible()
  })
})
