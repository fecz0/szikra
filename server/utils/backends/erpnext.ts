import type { Backend } from '../../domain/backend-types'
import { PaymentDeclined } from '../../domain/backend-types'
import { caseTypes } from '../../domain/case-types'
import type { AuditEntry, CaseTypeId, Invoice, PortalUser } from '../../domain/types'
import { payInvoiceInErp } from '../erp/actions'
import { ErpClient } from '../erp/client'
import { ACCESS_FIELDS, CUSTOMER_FIELDS, INVOICE_FIELDS, ISSUE_FIELDS, ITEM_FIELDS, PRODUCTION_FIELDS, READING_FIELDS, SUPPLY_FIELDS, mapAccess, mapCase, mapInvoice, mapInvoiceLines, mapPartner, mapProduction, mapReading, mapSupplyPoint } from '../erp/mappers'

const utc = (d = new Date()) => d.toISOString().replace('T', ' ').slice(0, 19)
const fromUtc = (s: string) => new Date(String(s).replace(' ', 'T') + 'Z').toISOString()

/** Élő ERPNext: minden hívás a REST API-n át megy, a böngésző sosem éri el közvetlenül. */
export class ErpNextBackend implements Backend {
  readonly kind = 'erpnext' as const
  private c: ErpClient
  private customers: { at: number, byId: Map<string, any>, byName: Map<string, string> } | null = null

  constructor(cfg: { erpBaseUrl: string, erpApiKey: string, erpApiSecret: string }) {
    if (!cfg.erpBaseUrl || !cfg.erpApiKey) throw new Error('NUXT_ERP_BASE_URL és NUXT_ERP_API_KEY/SECRET szükséges az erpnext háttérhez')
    this.c = new ErpClient(cfg.erpBaseUrl, { key: cfg.erpApiKey, secret: cfg.erpApiSecret })
  }

  private async cust() {
    if (this.customers && Date.now() - this.customers.at < 30_000) return this.customers
    const rows = await this.c.list('Customer', { fields: CUSTOMER_FIELDS, filters: [['szikra_id', 'is', 'set']] })
    this.customers = { at: Date.now(), byId: new Map(rows.map(r => [r.szikra_id, r])), byName: new Map(rows.map(r => [r.name, r.szikra_id])) }
    return this.customers
  }

  private async erpName(partnerId: string) {
    const r = (await this.cust()).byId.get(partnerId)
    if (!r) throw createError({ statusCode: 404, message: 'Ismeretlen cég' })
    return r.name as string
  }

  async listUsers() {
    const rows = await this.c.list('Szikra Portal Access', { fields: ACCESS_FIELDS })
    return mapAccess(rows, (await this.cust()).byName).users as PortalUser[]
  }

  async getUser(userId: string) {
    const rows = await this.c.list('Szikra Portal Access', { fields: ACCESS_FIELDS, filters: [['user_id', '=', userId]] })
    if (!rows.length) return null
    const cust = await this.cust()
    const { users, memberships } = mapAccess(rows, cust.byName)
    return {
      user: users[0]!,
      memberships: memberships.flatMap((m) => {
        const row = cust.byId.get(m.partnerId)
        return row ? [{ ...m, partner: mapPartner(row) }] : []
      }),
    }
  }

  private async invoicesFor(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Sales Invoice', { fields: INVOICE_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)], ['docstatus', '=', 1]], orderBy: 'posting_date asc' })
    return { rows, invoices: rows.filter(r => r.szikra_id).map(r => mapInvoice(r, cust.byName)) }
  }

  async listInvoices(partnerId: string) {
    return (await this.invoicesFor(partnerId)).invoices
  }

  async getInvoice(partnerId: string, invoiceId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Sales Invoice', { fields: INVOICE_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)], ['szikra_id', '=', invoiceId], ['docstatus', '=', 1]] })
    if (!rows.length) return null
    const items = await this.c.listChild('Sales Invoice Item', 'Sales Invoice', { fields: ITEM_FIELDS, filters: [['parent', '=', rows[0].name]] })
    const lines = mapInvoiceLines(items)
    return { ...mapInvoice(rows[0], cust.byName), ...(lines ? { lines } : {}) }
  }

  async payInvoice(partnerId: string, invoiceId: string, by: string) {
    const { rows, invoices } = await this.invoicesFor(partnerId)
    const inv: Invoice | undefined = invoices.find(i => i.id === invoiceId)
    if (!inv) throw createError({ statusCode: 404, message: 'A számla nem található' })
    if (inv.status === 'paid') throw createError({ statusCode: 409, message: 'A számla már ki van egyenlítve' })
    // "bank": a mock fizetési szolgáltató a partner demó-jelzője alapján elutasít
    if ((await this.cust()).byId.get(partnerId)?.szikra_card_declines) throw new PaymentDeclined()
    await payInvoiceInErp(this.c, rows.find(r => r.szikra_id === invoiceId)!.name)
    await this.note(partnerId, `${inv.period} számla kiegyenlítve (${by})`)
  }

  async listSupplyPoints(partnerId: string) {
    const rows = await this.c.list('Szikra Supply Point', { fields: SUPPLY_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]] })
    return rows.map(r => mapSupplyPoint(r, new Map([[r.customer, partnerId]])))
  }

  async listReadings(partnerId: string) {
    const points = await this.listSupplyPoints(partnerId)
    if (!points.length) return []
    const rows = await this.c.list('Szikra Meter Reading', { fields: READING_FIELDS, filters: [['supply_point', 'in', points.map(p => p.id)]], orderBy: 'date asc' })
    return rows.map(mapReading)
  }

  async listProduction(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Production', { fields: PRODUCTION_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]], orderBy: 'month asc' })
    return rows.map(r => mapProduction(r, cust.byName))
  }

  async listCases(partnerId: string) {
    const rows = await this.c.list('Issue', { fields: ISSUE_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)], ['szikra_case_type', 'is', 'set']], orderBy: 'creation desc' })
    const cust = await this.cust()
    return rows.map(r => mapCase(r, cust.byName))
  }

  async getCase(partnerId: string, caseId: string) {
    const rows = await this.c.list('Issue', { fields: ISSUE_FIELDS, filters: [['name', '=', caseId], ['customer', '=', await this.erpName(partnerId)]] })
    if (!rows.length) return null
    const comments = await this.c.list('Comment', {
      fields: ['creation', 'comment_by', 'content'], orderBy: 'creation asc',
      filters: [['reference_doctype', '=', 'Issue'], ['reference_name', '=', caseId], ['comment_type', '=', 'Comment']],
    })
    return mapCase(rows[0], (await this.cust()).byName, comments)
  }

  async createCase(input: { partnerId: string, type: CaseTypeId, subject: string, by: string, fields: Record<string, string> }) {
    const issue = await this.c.create('Issue', {
      subject: input.subject, customer: await this.erpName(input.partnerId), status: 'Open',
      szikra_case_type: input.type, szikra_fields: JSON.stringify(input.fields), szikra_created_by: input.by,
    })
    await this.note(input.partnerId, `Új ügy: ${caseTypes[input.type].label}`)
    return mapCase(issue, (await this.cust()).byName)
  }

  async addMessage(partnerId: string, caseId: string, msg: { by: string, text: string }) {
    if (!(await this.getCase(partnerId, caseId))) throw createError({ statusCode: 404, message: 'Az ügy nem található' })
    await this.c.create('Comment', { comment_type: 'Comment', reference_doctype: 'Issue', reference_name: caseId, comment_by: msg.by, content: msg.text })
  }

  async listNotifications(partnerId: string) {
    const rows = await this.c.list('Szikra Event', { fields: ['name', 'at', 'text', 'is_read'], filters: [['customer', '=', await this.erpName(partnerId)], ['kind', '=', 'notification']], orderBy: 'at desc' })
    return rows.map(r => ({ id: r.name, partnerId, at: fromUtc(r.at), text: r.text ?? '', read: !!r.is_read }))
  }

  async addAudit(entry: Omit<AuditEntry, 'at'>) {
    const customer = entry.partnerId === '-' ? undefined : await this.erpName(entry.partnerId)
    await this.c.create('Szikra Event', { kind: 'audit', customer, user_id: entry.userId, at: utc(), text: entry.action })
  }

  async listAudit(partnerId: string) {
    const rows = await this.c.list('Szikra Event', { fields: ['at', 'user_id', 'text'], filters: [['customer', '=', await this.erpName(partnerId)], ['kind', '=', 'audit']], orderBy: 'at desc' })
    return rows.map(r => ({ at: fromUtc(r.at), userId: r.user_id, partnerId, action: r.text }))
  }

  private async note(partnerId: string, text: string) {
    await this.c.create('Szikra Event', { kind: 'notification', customer: await this.erpName(partnerId), at: utc(), text })
  }
}
