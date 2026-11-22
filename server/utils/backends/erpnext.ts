import type { Backend } from '../../domain/backend-types'
import { PaymentDeclined } from '../../domain/backend-types'
import { caseTypes } from '../../domain/case-types'
import { REQUIRED_APPROVALS, approvalMessage, checkApproval, needsFourEyes } from '../../domain/approvals'
import type { TariffDef, AuditEntry, CaseTypeId, Invoice, PortalUser } from '../../domain/types'
import { payInvoiceInErp } from '../erp/actions'
import { ErpClient } from '../erp/client'
import { ACCESS_FIELDS, CUSTOMER_FIELDS, INVOICE_FIELDS, DEAL_FIELDS, ISSUE_FIELDS, OUTAGE_FIELDS, ITEM_FIELDS, PRODUCTION_FIELDS, SCHEDULE_FIELDS, READING_FIELDS, SUPPLY_FIELDS, mapAccess, mapCase, mapDeal, mapInterval, mapInvoice, mapOutage, mapTariff, parseApprovals, mapInvoiceLines, mapPartner, mapProduction, mapReading, mapSchedule, mapSupplyPoint } from '../erp/mappers'

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

  async listDeals(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Deal', { fields: DEAL_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]], orderBy: 'trade_date desc' })
    return rows.map(r => mapDeal(r, cust.byName))
  }

  async confirmDeal(partnerId: string, dealId: string, by: string) {
    const rows = await this.c.list('Szikra Deal', { fields: ['name', 'status', 'product'], filters: [['customer', '=', await this.erpName(partnerId)], ['szikra_id', '=', dealId]] })
    if (!rows.length) throw createError({ statusCode: 404, message: 'Az ügylet nem található' })
    if (rows[0].status !== 'visszaigazolasra-var') throw createError({ statusCode: 409, message: 'Az ügylet nem vár visszaigazolásra' })
    await this.c.update('Szikra Deal', rows[0].name, { status: 'visszaigazolva' })
    await this.note(partnerId, `Ügylet visszaigazolva: ${rows[0].product} (${by})`)
  }

  async listSchedule(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Schedule', { fields: SCHEDULE_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]], orderBy: 'date desc' })
    return rows.map(r => mapSchedule(r, cust.byName))
  }

  async submitSchedule(partnerId: string, day: { date: string, commodity: 'villany' | 'gaz', values: number[], by: string }) {
    const id = `${partnerId}-SCH-${day.commodity === 'villany' ? 'E' : 'G'}-${day.date.replaceAll('-', '')}`
    const customer = await this.erpName(partnerId)
    const have = await this.c.list('Szikra Schedule', { fields: ['name'], filters: [['szikra_id', '=', id]] })
    const body = { values_json: JSON.stringify(day.values), status: 'benyujtva', submitted_by: day.by }
    if (have.length) await this.c.update('Szikra Schedule', have[0].name, body)
    else await this.c.create('Szikra Schedule', { szikra_id: id, customer, date: day.date, commodity: day.commodity, ...body })
    await this.note(partnerId, `Menetrend benyújtva: ${day.commodity === 'villany' ? 'villany' : 'gáz'}, ${day.date} (${day.by})`)
    return { id, partnerId, date: day.date, commodity: day.commodity, values: day.values, status: 'benyujtva' as const, submittedBy: day.by }
  }

  async listOutages(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Outage', { fields: OUTAGE_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]], orderBy: 'date_from asc' })
    return rows.map(r => mapOutage(r, cust.byName))
  }

  async proposeOutage(partnerId: string, input: { supplyPointId: string, kind: 'tervezett' | 'rendkivuli', from: string, to: string, purpose: string, by: { userId: string, name: string } }) {
    const customer = await this.erpName(partnerId)
    const n = (await this.c.list('Szikra Outage', { fields: ['name'], filters: [['customer', '=', customer]] })).length + 1
    const id = `${partnerId}-OUT-${String(n).padStart(2, '0')}`
    await this.c.create('Szikra Outage', { szikra_id: id, customer, supply_point: input.supplyPointId, kind: input.kind, date_from: input.from, date_to: input.to, purpose: input.purpose, proposed_by_id: input.by.userId, proposed_by_name: input.by.name, status: 'jovahagyasra-var', approvals_json: '[]' })
    await this.note(partnerId, `Új leállás-javaslat: ${input.from} – ${input.to} (${input.by.name})`)
    return { id, partnerId, supplyPointId: input.supplyPointId, kind: input.kind, from: input.from, to: input.to, purpose: input.purpose, proposedBy: input.by, status: 'jovahagyasra-var' as const, approvals: [] }
  }

  async approveOutage(partnerId: string, outageId: string, by: { userId: string, name: string }) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Outage', { fields: ['name', ...OUTAGE_FIELDS], filters: [['customer', '=', await this.erpName(partnerId)], ['szikra_id', '=', outageId]] })
    if (!rows.length) throw createError({ statusCode: 404, message: 'A leállás nem található' })
    const o = mapOutage(rows[0], cust.byName)
    if (o.status === 'jovahagyva') throw createError({ statusCode: 409, message: 'A leállás már jóvá van hagyva' })
    const check = checkApproval(o.approvals, by.userId, o.proposedBy.userId)
    if (check !== 'ok') throw createError({ statusCode: 409, message: approvalMessage[check] })
    o.approvals.push({ ...by, at: new Date().toISOString() })
    if (o.approvals.length >= REQUIRED_APPROVALS) o.status = 'jovahagyva'
    await this.c.update('Szikra Outage', rows[0].name, { approvals_json: JSON.stringify(o.approvals), status: o.status })
    await this.note(partnerId, `Leállás jóváhagyva (${o.approvals.length}/${REQUIRED_APPROVALS}): ${o.from} – ${o.to}`)
    return o
  }

  async approveSettlements(partnerId: string, month: string, by: { userId: string, name: string }) {
    const rows = await this.c.list('Szikra Production', { fields: ['name', 'settlement_huf', 'status', 'approvals_json'], filters: [['customer', '=', await this.erpName(partnerId)], ['month', '=', month], ['status', '=', 'tervezet']] })
    const recs = rows.filter(r => needsFourEyes(Math.round(Number(r.settlement_huf))))
    if (!recs.length) throw createError({ statusCode: 404, message: 'Nincs jóváhagyásra váró elszámolás ebben a hónapban' })
    let done = 0
    for (const r of recs) {
      const approvals = parseApprovals(r.approvals_json)
      if (checkApproval(approvals, by.userId) !== 'ok') continue
      approvals.push({ ...by, at: new Date().toISOString() })
      await this.c.update('Szikra Production', r.name, { approvals_json: JSON.stringify(approvals), status: approvals.length >= REQUIRED_APPROVALS ? 'jovahagyva' : 'tervezet' })
      done++
    }
    if (!done) throw createError({ statusCode: 409, message: approvalMessage['mar-jovahagyta'] })
    await this.note(partnerId, `Átvételi elszámolás jóváhagyva: ${month} (${by.name})`)
    return done
  }

  async listIntervals(partnerId: string, supplyPointId?: string) {
    const points = (await this.listSupplyPoints(partnerId)).filter(p => !supplyPointId || p.id === supplyPointId)
    if (!points.length) return []
    const rows = await this.c.list('Szikra Interval Data', { fields: INTERVAL_FIELDS, filters: [['supply_point', 'in', points.map(p => p.id)]], orderBy: 'month asc' })
    return rows.map(mapInterval)
  }

  async listTariffs(partnerId: string) {
    const cust = await this.cust()
    const rows = await this.c.list('Szikra Tariff', { fields: TARIFF_FIELDS, filters: [['customer', '=', await this.erpName(partnerId)]] })
    return rows.map(r => mapTariff(r, cust.byName))
  }

  async createTariff(partnerId: string, def: Omit<TariffDef, 'id' | 'partnerId' | 'system'>, by: string) {
    const customer = await this.erpName(partnerId)
    const n = (await this.c.list('Szikra Tariff', { fields: ['name'], filters: [['customer', '=', customer]] })).length + 1
    const id = `${partnerId}-TAR-${String(n).padStart(2, '0')}`
    const { name, kind, ...params } = def
    await this.c.create('Szikra Tariff', { szikra_id: id, customer, tariff_name: name, kind, params_json: JSON.stringify(params) })
    await this.note(partnerId, `Új díjcsomag: ${name} (${by})`)
    return { ...def, id, partnerId }
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
