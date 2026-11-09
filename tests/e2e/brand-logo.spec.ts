import { test, expect } from './support/fixtures'

test.describe('Szikra logó', () => {
  test('a fejlécben 28–32 px magas, középre igazított vektoros szikra-ikon és „Szikra” szöveglogó látszik', async ({ page }) => {
    await page.goto('/')

    const logo = page.getByTestId('brand-logo')
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAccessibleName('Szikra')

    const logoBox = await logo.boundingBox()
    const headerBox = await page.getByRole('banner').boundingBox()
    expect(logoBox).not.toBeNull()
    expect(headerBox).not.toBeNull()

    // A logó 28–32 px magas.
    expect(logoBox!.height).toBeGreaterThanOrEqual(28)
    expect(logoBox!.height).toBeLessThanOrEqual(32)

    // A fejlécben függőlegesen középre igazítva.
    const logoCenter = logoBox!.y + logoBox!.height / 2
    const headerCenter = headerBox!.y + headerBox!.height / 2
    expect(Math.abs(logoCenter - headerCenter)).toBeLessThanOrEqual(2)

    // Geometrikus, vektoros ikon; nem emoji, nem raster kép.
    const icon = logo.locator('svg')
    await expect(icon).toHaveCount(1)
    expect(await icon.locator('path, polygon, rect, circle, line, polyline').count()).toBeGreaterThan(0)
    await expect(logo.locator('img')).toHaveCount(0)
    await expect(logo).not.toContainText('⚡')
  })

  test('a „Szikra” szöveg 700-as súlyú, a márka narancs színében, dark módban is', async ({ page }) => {
    await page.goto('/')

    const logo = page.getByTestId('brand-logo')
    await expect(logo).toHaveCSS('font-weight', '700')
    await expect(logo).toHaveCSS('color', 'rgb(232, 89, 12)')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(logo).toHaveCSS('color', 'rgb(255, 138, 76)')
  })

  test('a logóra kattintva a kezdőlapra navigál', async ({ page, sap }) => {
    const customerId = await sap.seed('okosmero-gaz-villany')
    await page.goto(`/fiok/${customerId}`)

    await page.getByTestId('brand-logo').click()
    await expect(page).toHaveURL(/\/$/)
  })
})
