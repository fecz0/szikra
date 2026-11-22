import { caseTypes } from '../../domain/case-types.ts'
import type { CaseRecord, CaseStatus, CaseTypeId, Invoice, InvoiceLine, InvoiceUsage, Partner, PartnerKind, PortalUser, ProductionRecord, Reading, Role, Segment, SupplyPoint } from '../../domain/types.ts'

/** ERPNext-mezők -> portál domain-típusok. A seed, az export és az élő adapter ugyanezt használja. */

export const CUSTOMER_FIELDS = ['name', 'customer_name', 'szikra_id', 'tax_id', 'szikra_address', 'szikra_segment', 'szikra_contract_no', 'szikra_card_declines', 'szikra_kind']
export const INVOICE_FIELDS = ['name', 'szikra_id', 'customer', 'posting_date', 'due_date', 'grand_total', 'outstanding_amount', 'szikra_period', 'szikra_supply_point', 'szikra_usage']
export const SUPPLY_FIELDS = ['name', 'szikra_id', 'customer', 'energy', 'pod', 'address', 'meter_serial', 'smart', 'last_reading', 'last_reading_date', 'unit', 'label', 'tariff', 'capacity_kw', 'direction', 'contracted_kw', 'network_category']
export const ISSUE_FIELDS = ['name', 'subject', 'status', 'creation', 'customer', 'szikra_case_type', 'szikra_fields', 'szikra_created_by']
export const ITEM_FIELDS = ['parent', 'item_code', 'item_name', 'qty', 'uom', 'rate', 'amount', 'szikra_category', 'idx']
export const READING_FIELDS = ['supply_point', 'date', 'value']
export const PRODUCTION_FIELDS = ['szikra_id', 'customer', 'supply_point', 'month', 'mwh', 'price_huf_per_mwh', 'premium_huf', 'imbalance_huf', 'settlement_huf', 'status']
export const ACCESS_FIELDS = ['name', 'user_id', 'full_name', 'email', 'note', 'customer', 'role']

export const issueStatusToCase: Record<string, CaseStatus> = {
  'Open': 'uj', 'Replied': 'folyamatban', 'On Hold': 'visszajelzesre-var', 'Resolved': 'lezart', 'Closed': 'lezart',
}

/**
 * Az ERPNext a megjegyzéseket HTML-ként tárolja (a felületen írt válasz `<div><p>…</p></div>`).
 * Szándékosan nem regex: karakterenként dobjuk el a `<`…`>` közötti részt, és soha nem adunk ki `<` jelet,
 * így egymásba ágyazott vagy csonka címkékből sem állhat össze új címke. A kimenetet a Vue úgyis escape-eli.
 */
export function htmlToText(html: string): string {
  let out = ''
  let inTag = false
  for (const ch of html) {
    if (ch === '<') inTag = true
    else if (ch === '>') inTag = false
    else if (!inTag) out += ch
  }
  return out.replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').trim()
}

export function mapPartner(c: any): Partner {
  return {
    id: c.szikra_id || c.name,
    name: c.customer_name,
    taxNumber: c.tax_id ?? '',
    address: c.szikra_address ?? '',
    segment: (c.szikra_segment || 'ipari') as Segment,
    ...(c.szikra_kind === 'termelo' ? { kind: 'termelo' as PartnerKind } : {}),
    contractNo: c.szikra_contract_no ?? '',
    ...(c.szikra_card_declines ? { cardDeclines: true } : {}),
  }
}

export function invoiceStatus(si: { outstanding_amount: number, due_date: string }, today = new Date().toISOString().slice(0, 10)): Invoice['status'] {
  if (!si.outstanding_amount) return 'paid'
  return si.due_date < today ? 'overdue' : 'open'
}

export function mapInvoice(si: any, partnerIdByCustomer: Map<string, string>, supplyIdByName?: Map<string, string>): Invoice {
  let usage: InvoiceUsage | undefined
  try { usage = si.szikra_usage ? JSON.parse(si.szikra_usage) : undefined } catch { /* sérült JSON: nincs mérőadat */ }
  return {
    id: si.szikra_id || si.name,
    partnerId: partnerIdByCustomer.get(si.customer) ?? si.customer,
    ...(si.szikra_supply_point ? { supplyPointId: si.szikra_supply_point } : {}),
    period: si.szikra_period ?? si.posting_date,
    amountHuf: Math.round(si.grand_total),
    issueDate: si.posting_date,
    dueDate: si.due_date,
    status: invoiceStatus(si),
    ...(usage ? { usage } : {}),
  }
}

export function mapInvoiceLines(items: any[]): InvoiceLine[] | undefined {
  // csak a kategorizált tételek számítanak számlakép-tételnek (a régi egysoros számláknak nincs)
  const rows = items.filter(i => i.szikra_category).sort((a, b) => a.idx - b.idx)
  if (!rows.length) return undefined
  return rows.map(i => ({ code: i.item_code, label: i.item_name, category: i.szikra_category, quantity: Number(i.qty), unit: i.uom, unitPrice: Number(i.rate), amountHuf: Math.round(Number(i.amount)) }))
}

export function mapSupplyPoint(s: any, partnerIdByCustomer: Map<string, string>): SupplyPoint {
  return {
    id: s.szikra_id || s.name,
    partnerId: partnerIdByCustomer.get(s.customer) ?? s.customer,
    type: s.energy,
    pod: s.pod,
    address: s.address ?? '',
    meterSerial: s.meter_serial ?? '',
    smart: !!s.smart,
    lastReading: Number(s.last_reading ?? 0),
    lastReadingDate: s.last_reading_date ?? '',
    unit: s.unit,
    ...(s.label ? { label: s.label } : {}),
    ...(s.tariff ? { tariff: s.tariff } : {}),
    ...(s.capacity_kw ? { capacityKw: Number(s.capacity_kw) } : {}),
    ...(s.contracted_kw ? { contractedKw: Number(s.contracted_kw) } : {}),
    ...(s.network_category ? { networkCategory: s.network_category } : {}),
    // a fogyasztás az alapértelmezés, csak a termelés jelölt
    ...(s.direction === 'termeles' ? { direction: 'termeles' as const } : {}),
  }
}

export function mapReading(r: any): Reading {
  return { supplyPointId: r.supply_point, date: r.date, value: Number(r.value) }
}

export function mapProduction(p: any, partnerIdByCustomer: Map<string, string>): ProductionRecord {
  return {
    id: p.szikra_id || p.name,
    partnerId: partnerIdByCustomer.get(p.customer) ?? p.customer,
    supplyPointId: p.supply_point,
    month: p.month,
    mwh: Number(p.mwh),
    priceHufPerMwh: Number(p.price_huf_per_mwh),
    premiumHuf: Math.round(Number(p.premium_huf ?? 0)),
    imbalanceHuf: Math.round(Number(p.imbalance_huf ?? 0)),
    settlementHuf: Math.round(Number(p.settlement_huf)),
    status: p.status,
  }
}

export function mapCase(i: any, partnerIdByCustomer: Map<string, string>, comments: any[] = []): CaseRecord {
  const type = (i.szikra_case_type || 'ajanlatkeres') as CaseTypeId
  let fields: Record<string, string> = {}
  try { fields = JSON.parse(i.szikra_fields || '{}') } catch { /* sérült JSON: üres mezők */ }
  return {
    id: i.name,
    partnerId: partnerIdByCustomer.get(i.customer) ?? i.customer,
    type,
    subject: i.subject ?? caseTypes[type]?.label ?? type,
    status: issueStatusToCase[i.status] ?? 'uj',
    createdAt: new Date(String(i.creation).replace(' ', 'T') + (String(i.creation).includes('Z') ? '' : 'Z')).toISOString(),
    createdBy: i.szikra_created_by ?? '',
    fields,
    messages: comments.map(c => ({
      at: new Date(String(c.creation).replace(' ', 'T') + 'Z').toISOString(),
      by: c.comment_by ?? '',
      text: htmlToText(String(c.content ?? '')),
    })),
  }
}

/** A Portal Access sorokból felhasználók + tagságok. */
export function mapAccess(rows: any[], partnerIdByCustomer: Map<string, string>) {
  const users = new Map<string, PortalUser>()
  const memberships: { userId: string, partnerId: string, role: Role }[] = []
  for (const r of rows) {
    if (!users.has(r.user_id)) users.set(r.user_id, { id: r.user_id, name: r.full_name, email: r.email ?? '', note: r.note ?? '' })
    memberships.push({ userId: r.user_id, partnerId: partnerIdByCustomer.get(r.customer) ?? r.customer, role: r.role })
  }
  return { users: [...users.values()], memberships }
}
