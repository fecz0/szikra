import { test, expect } from './support/fixtures'

test('a fejlécben inline SVG logó és „Szikra” szöveg látszik, régi emoji nélkül', async ({ page }) => {
  await page.goto('/')

  const logo = page.getByTestId('brand-logo')
  await expect(logo).toBeVisible()
  await expect(logo).toHaveAccessibleName('Szikra')
  await expect(logo).toContainText('Szikra')
  await expect(logo.locator('svg')).toBeVisible()
  await expect(page.getByRole('banner')).not.toContainText('⚡')
})

test('a logó kattintásra a főoldalra navigál', async ({ page }) => {
  await page.goto('/fiok/NEMLETEZIK')
  await page.getByTestId('brand-logo').click()
  await expect(page).toHaveURL(/\/$/)
})

test('a logó dark módban is jól látható', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')

  const logo = page.getByTestId('brand-logo')
  await expect(logo.locator('svg')).toBeVisible()

  const { color, background } = await logo.locator('svg').evaluate((el) => ({
    color: getComputedStyle(el).color,
    background: getComputedStyle(document.body).backgroundColor,
  }))
  expect(color).not.toBe(background)
})
