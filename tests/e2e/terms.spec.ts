import type { Page } from '@playwright/test'
import { test, expect } from './support/fixtures'

const CURRENT_VERSION = 'ASZF-2026-2'
const CURRENT_DATE = '2026-11-01'

async function login(page: Page, id: string) {
  await page.goto('/')
  await page.getByLabel('Ügyfélazonosító').fill(id)
  await page.getByRole('button', { name: 'Belépés' }).click()
}

test.describe('ÁSZF-változás elfogadása belépés után', () => {
  test('elavult elfogadás esetén blokkoló modal jelenik meg az aktuális verzióval', async ({ page, sap }) => {
    const id = await sap.seed('elmaradt-szamla')

    await login(page, id)

    await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
    await expect(page.getByTestId('terms-modal')).toBeVisible()
    await expect(page.getByTestId('terms-version')).toContainText(CURRENT_VERSION)
    await expect(page.getByTestId('terms-version')).toContainText(CURRENT_DATE)
  })

  test('a modal blokkolja a fiókoldalt, és ESC-kel, overlay-kattintással sem zárható be', async ({ page, sap }) => {
    const id = await sap.seed('elmaradt-szamla')
    await login(page, id)

    const modal = page.getByTestId('terms-modal')
    await expect(modal).toBeVisible()
    await expect(page.getByTestId('account-content')).toHaveAttribute('inert', '')

    await page.keyboard.press('Escape')
    await expect(modal).toBeVisible()

    await page.mouse.click(2, 2)
    await expect(modal).toBeVisible()

    await expect(page.getByRole('button', { name: /bezár/i })).toHaveCount(0)
    await expect(page.getByTestId('terms-accept')).toBeVisible()
  })

  test('Elfogadom: a modal eltűnik, a fiókoldal használható', async ({ page, sap }) => {
    const id = await sap.seed('elmaradt-szamla')
    await login(page, id)

    await expect(page.getByTestId('terms-modal')).toBeVisible()
    await page.getByTestId('terms-accept').click()

    await expect(page.getByTestId('terms-modal')).toHaveCount(0)
    await expect(page.getByTestId('account-content')).not.toHaveAttribute('inert', '')

    const bill = page.getByTestId(`bill-${id}-B1`)
    await bill.getByRole('button', { name: 'Fizetés' }).click()
    await expect(page.getByRole('status')).toHaveText('Sikeres fizetés')
    await expect(bill.getByTestId('bill-status')).toHaveText('Kiegyenlítve')
  })

  test('elfogadás után ugyanazzal a felhasználóval újra belépve nem jelenik meg a modal', async ({ page, sap }) => {
    const id = await sap.seed('elmaradt-szamla')
    await login(page, id)
    await page.getByTestId('terms-accept').click()
    await expect(page.getByTestId('terms-modal')).toHaveCount(0)

    await page.goto('/')
    await page.getByLabel('Ügyfélazonosító').fill(id)
    await page.getByRole('button', { name: 'Belépés' }).click()

    await expect(page).toHaveURL(new RegExp(`/fiok/${id}$`))
    await expect(page.getByTestId('customer-name')).toHaveText('Késő Kata')
    await expect(page.getByTestId('terms-modal')).toHaveCount(0)
  })

  test('ha az elfogadott verzió megegyezik az aktuálissal, nincs modal', async ({ page, sap }) => {
    const id = await sap.seed('okosmero-gaz-villany')

    await login(page, id)

    await expect(page.getByTestId('customer-name')).toHaveText('Teszt Elek')
    await expect(page.getByTestId('terms-modal')).toHaveCount(0)
    await expect(page.getByTestId('account-content')).not.toHaveAttribute('inert', '')
  })

  test('a demó ügyfelek között van elavult ÁSZF-elfogadású', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('demo-users').getByRole('link', { name: 'Késő Kata' }).click()

    await expect(page).toHaveURL(/\/fiok\/DEMO-ELMARADT$/)
    await expect(page.getByTestId('terms-modal')).toBeVisible()
    await expect(page.getByTestId('terms-version')).toContainText(CURRENT_VERSION)
  })
})
