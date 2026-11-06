import { test, expect } from './support/fixtures'

test('a belépő oldal listázza a demó ügyfeleket', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('demo-users').getByRole('link')).toHaveCount(4)
})

const expected = {
  'DEMO-OKOS': 'Teszt Elek',
  'DEMO-ELMARADT': 'Késő Kata',
  'DEMO-KARTYA': 'Pech Péter',
  'DEMO-RENDEZETT': 'Rendes Réka',
} as const

for (const [id, name] of Object.entries(expected)) {
  test(`${id} belép és a(z) ${name} adatai látszanak`, async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('demo-users').getByRole('link', { name }).click()
    await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
    await expect(page.getByTestId('customer-name')).toHaveText(name)
  })
}

test('health végpont él', async ({ request }) => {
  const res = await request.get('/api/health')
  expect((await res.json()).status).toBe('ok')
})
