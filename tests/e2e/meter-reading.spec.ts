import { test, expect } from './support/fixtures'

// Mérőóra-állás megadása a főoldali belépő kártyán, belépés nélkül.
test.describe('Mérőóra-állás megadása', () => {
  test('a belépés gomb alatt látható a link, belépés nélkül elérhető', async ({ page }) => {
    await page.goto('/')

    const loginButton = page.getByRole('button', { name: 'Belépés' })
    const link = page.getByTestId('meter-reading-link')

    await expect(link).toBeVisible()
    await expect(link).toHaveText('Mérőóra-állás megadása')

    // Közvetlenül a belépés gomb alatt van.
    const buttonBox = await loginButton.boundingBox()
    const linkBox = await link.boundingBox()
    expect(buttonBox).not.toBeNull()
    expect(linkBox).not.toBeNull()
    expect(linkBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height)

    // Az űrlap csak kattintásra jelenik meg.
    await expect(page.getByTestId('meter-reading-form')).toHaveCount(0)
  })

  test('a linkre kattintva megjelenik az űrlap a mérőóra szám és állás mezővel', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('meter-reading-link').click()

    await expect(page.getByTestId('meter-reading-form')).toBeVisible()
    await expect(page.getByTestId('meter-number-input')).toBeVisible()
    await expect(page.getByTestId('meter-reading-input')).toBeVisible()
  })

  test('érvénytelen adatoknál magyar hibaüzenet jelenik meg, nincs visszaigazolás', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('meter-reading-link').click()

    const numberInput = page.getByTestId('meter-number-input')
    const readingInput = page.getByTestId('meter-reading-input')
    const submit = page.getByRole('button', { name: 'Beküldés' })
    const error = page.getByTestId('meter-reading-form').getByRole('alert')
    const confirmation = page.getByTestId('meter-reading-confirmation')

    // Üres mérőóra szám.
    await readingInput.fill('1234')
    await submit.click()
    await expect(error).toContainText('mérőóra szám')

    // Üres állás.
    await numberInput.fill('M-12345')
    await readingInput.fill('')
    await submit.click()
    await expect(error).toContainText('állás')

    // Nem numerikus állás.
    await readingInput.fill('nem-szam')
    await submit.click()
    await expect(error).toContainText('szám')

    // Negatív állás.
    await readingInput.fill('-12')
    await submit.click()
    await expect(error).toContainText('negatív')

    await expect(confirmation).toHaveCount(0)
  })

  test('érvényes adatokkal a beküldés után megjelenik a visszaigazolás', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('meter-reading-link').click()

    await page.getByTestId('meter-number-input').fill('M-98765')
    await page.getByTestId('meter-reading-input').fill('4321')
    await page.getByRole('button', { name: 'Beküldés' }).click()

    const confirmation = page.getByTestId('meter-reading-confirmation')
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toContainText('M-98765')
    await expect(confirmation).toContainText('4321')
  })
})
