import type { Dataset } from '../../domain/types.ts'
import type { ErpClient } from './client.ts'
import { ACCESS_FIELDS, CUSTOMER_FIELDS, INVOICE_FIELDS, ISSUE_FIELDS, PRODUCTION_FIELDS, READING_FIELDS, SUPPLY_FIELDS, mapAccess, mapCase, mapInvoice, mapPartner, mapProduction, mapReading, mapSupplyPoint } from './mappers.ts'

/** Az ERPNext teljes tartalma portál-formátumban: ez a JSON snapshot (deploy) forrása. */
export async function fetchDataset(c: ErpClient): Promise<Dataset> {
  const customers = await c.list('Customer', { fields: CUSTOMER_FIELDS, filters: [['szikra_id', 'is', 'set']] })
  const byCustomer = new Map<string, string>(customers.map(x => [x.name, x.szikra_id]))

  const [invoices, supply, issues, access, events, readings, production] = await Promise.all([
    c.list('Sales Invoice', { fields: INVOICE_FIELDS, filters: [['docstatus', '=', 1]], orderBy: 'posting_date asc' }),
    c.list('Szikra Supply Point', { fields: SUPPLY_FIELDS }),
    c.list('Issue', { fields: ISSUE_FIELDS, orderBy: 'creation asc' }),
    c.list('Szikra Portal Access', { fields: ACCESS_FIELDS }),
    c.list('Szikra Event', { fields: ['name', 'customer', 'at', 'text', 'is_read'], filters: [['kind', '=', 'notification']] }),
    c.list('Szikra Meter Reading', { fields: READING_FIELDS, orderBy: 'date asc' }),
    c.list('Szikra Production', { fields: PRODUCTION_FIELDS, orderBy: 'month asc' }),
  ])
  const cases = []
  for (const i of issues.filter(x => x.szikra_case_type)) {
    const comments = await c.list('Comment', {
      fields: ['creation', 'comment_by', 'content'], orderBy: 'creation asc',
      filters: [['reference_doctype', '=', 'Issue'], ['reference_name', '=', i.name], ['comment_type', '=', 'Comment']],
    })
    cases.push(mapCase(i, byCustomer, comments))
  }
  const { users, memberships } = mapAccess(access, byCustomer)
  return {
    partners: customers.map(mapPartner),
    users,
    memberships,
    supplyPoints: supply.map(s => mapSupplyPoint(s, byCustomer)),
    readings: readings.map(mapReading),
    production: production.map(p => mapProduction(p, byCustomer)),
    invoices: invoices.filter(i => i.szikra_id).map(i => mapInvoice(i, byCustomer)),
    cases,
    notifications: events.map(e => ({
      id: e.name, partnerId: byCustomer.get(e.customer) ?? e.customer,
      at: new Date(String(e.at).replace(' ', 'T') + 'Z').toISOString(), text: e.text ?? '', read: !!e.is_read,
    })),
  }
}
