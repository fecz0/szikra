import type { ErpClient } from './client.ts'

/**
 * Számla kiegyenlítése ERPNext-ben: Payment Entry a számlára (a "mock fizetési szolgáltató"
 * jóváhagyása után). Az ERPNext maga számolja az egyenleget és a státuszt.
 */
export async function payInvoiceInErp(c: ErpClient, invoiceName: string, reference = 'SZIKRA-KARTYA') {
  const pe = await c.method<Record<string, any>>('erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry', { dt: 'Sales Invoice', dn: invoiceName }, 'GET')
  pe.reference_no = reference
  pe.reference_date = new Date().toISOString().slice(0, 10)
  const saved = await c.create('Payment Entry', pe)
  await c.method('frappe.client.submit', { doc: saved })
}
