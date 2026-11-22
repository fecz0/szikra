import type { Dataset } from '../../domain/types.ts'
import type { ErpClient } from './client.ts'
import { ACCESS_FIELDS, CUSTOMER_FIELDS, INVOICE_FIELDS, DEAL_FIELDS, ISSUE_FIELDS, OUTAGE_FIELDS, ITEM_FIELDS, PRODUCTION_FIELDS, SCHEDULE_FIELDS, READING_FIELDS, SUPPLY_FIELDS, mapAccess, mapCase, mapAuditEvent, mapDeal, mapInvoice, mapInvoiceLines, mapOutage, mapPartner, mapProduction, mapReading, mapSchedule, mapSupplyPoint } from './mappers.ts'

/** Az ERPNext teljes tartalma portál-formátumban: ez a JSON snapshot (deploy) forrása. */
export async function fetchDataset(c: ErpClient): Promise<Dataset> {
  const customers = await c.list('Customer', { fields: CUSTOMER_FIELDS, filters: [['szikra_id', 'is', 'set']] })
  const byCustomer = new Map<string, string>(customers.map(x => [x.name, x.szikra_id]))

  const [invoices, supply, issues, access, events, readings, production, deals, schedule, outages, auditEvents] = await Promise.all([
    c.list('Sales Invoice', { fields: INVOICE_FIELDS, filters: [['docstatus', '=', 1]], orderBy: 'posting_date asc' }),
    c.list('Szikra Supply Point', { fields: SUPPLY_FIELDS }),
    c.list('Issue', { fields: ISSUE_FIELDS, orderBy: 'creation asc' }),
    c.list('Szikra Portal Access', { fields: ACCESS_FIELDS }),
    c.list('Szikra Event', { fields: ['name', 'customer', 'at', 'text', 'is_read'], filters: [['kind', '=', 'notification']] }),
    c.list('Szikra Meter Reading', { fields: READING_FIELDS, orderBy: 'date asc' }),
    c.list('Szikra Production', { fields: PRODUCTION_FIELDS, orderBy: 'month asc' }),
    c.list('Szikra Deal', { fields: DEAL_FIELDS, orderBy: 'trade_date asc' }),
    c.list('Szikra Schedule', { fields: SCHEDULE_FIELDS, orderBy: 'date asc' }),
    c.list('Szikra Outage', { fields: OUTAGE_FIELDS, orderBy: 'date_from asc' }),
    c.list('Szikra Event', { fields: ['customer', 'user_id', 'at', 'text'], filters: [['kind', '=', 'audit']], orderBy: 'at asc' }),
  ])
  const itemRows = await c.listChild('Sales Invoice Item', 'Sales Invoice', { fields: ITEM_FIELDS, filters: [['docstatus', '=', 1]] })
  const itemsBySi = new Map<string, any[]>()
  for (const it of itemRows) itemsBySi.set(it.parent, [...(itemsBySi.get(it.parent) ?? []), it])
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
    deals: deals.map(x => mapDeal(x, byCustomer)),
    schedule: schedule.map(x => mapSchedule(x, byCustomer)),
    outages: outages.map(x => mapOutage(x, byCustomer)),
    audit: auditEvents.filter(e => e.customer).map(e => mapAuditEvent(e, byCustomer)),
    invoices: invoices.filter(i => i.szikra_id).map((i) => {
      const lines = mapInvoiceLines(itemsBySi.get(i.name) ?? [])
      return { ...mapInvoice(i, byCustomer), ...(lines ? { lines } : {}) }
    }),
    cases,
    notifications: events.map(e => ({
      id: e.name, partnerId: byCustomer.get(e.customer) ?? e.customer,
      at: new Date(String(e.at).replace(' ', 'T') + 'Z').toISOString(), text: e.text ?? '', read: !!e.is_read,
    })),
  }
}
