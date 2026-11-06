import { test, expect } from './support/fixtures'

test('számla kifizetése bankkártyával', async ({ page, sap }) => {
  const id = await sap.seed('okosmero-gaz-villany')
  await page.goto(`/fiok/${id}`)

  const bill = page.getByTestId(`bill-${id}-B1`)
  await expect(bill.getByTestId('bill-status')).toHaveText('Nyitott')
  await bill.getByRole('button', { name: 'Fizetés' }).click()

  await expect(page.getByRole('status')).toHaveText('Sikeres fizetés')
  await expect(bill.getByTestId('bill-status')).toHaveText('Kiegyenlítve')
  // a másik számla érintetlen
  await expect(page.getByTestId(`bill-${id}-B2`).getByTestId('bill-status')).toHaveText('Nyitott')
})

test('elutasított kártya: hibaüzenet, a számla nyitott marad', async ({ page, sap }) => {
  const id = await sap.seed('kartya-elutasitva')
  await page.goto(`/fiok/${id}`)

  await page.getByRole('button', { name: 'Fizetés' }).click()

  await expect(page.getByRole('alert')).toContainText('elutasította')
  await expect(page.getByTestId('bill-status')).toHaveText('Nyitott')
})
