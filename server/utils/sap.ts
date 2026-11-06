import type { H3Event } from 'h3'
import type { SapCustomer } from '../mock-sap/types'

/**
 * SAP adapter: az alkalmazás kizárólag ezen keresztül beszél a SAP-pal.
 * Mock módban a saját /mock-sap útvonalakat hívja, éles/sandbox módban a
 * NUXT_SAP_BASE_URL-t — a hívó kód nem tudja a különbséget.
 */
function baseUrl(event: H3Event): string {
  const cfg = useRuntimeConfig(event)
  if (cfg.sapBaseUrl) return cfg.sapBaseUrl
  if (cfg.mockSap) return `${getRequestURL(event).origin}/mock-sap`
  throw createError({ statusCode: 500, statusMessage: 'SAP nincs konfigurálva' })
}

export function sapGetCustomer(event: H3Event, id: string) {
  return $fetch<SapCustomer>(`${baseUrl(event)}/customers/${encodeURIComponent(id)}`)
}

export function sapPayBill(event: H3Event, customerId: string, billId: string) {
  return $fetch<{ billId: string, status: string }>(
    `${baseUrl(event)}/customers/${encodeURIComponent(customerId)}/payments`,
    { method: 'POST', body: { billId } },
  )
}
