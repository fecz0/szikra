import { caseTypes } from '../../domain/case-types.ts'
import type { CaseRecord, CaseStatus, CaseTypeId, Invoice, Partner, PortalUser, Role, Segment, SupplyPoint } from '../../domain/types.ts'

/** ERPNext-mezők -> portál domain-típusok. A seed, az export és az élő adapter ugyanezt használja. */

export const CUSTOMER_FIELDS = ['name', 'customer_name', 'szikra_id', 'tax_id', 'szikra_address', 'szikra_segment', 'szikra_contract_no', 'szikra_card_declines']
export const INVOICE_FIELDS = ['name', 'szikra_id', 'customer', 'posting_date', 'due_date', 'grand_total', 'outstanding_amount', 'szikra_period', 'szikra_supply_point']
export const SUPPLY_FIELDS = ['name', 'szikra_id', 'customer', 'energy', 'pod', 'address', 'meter_serial', 'smart', 'last_reading', 'last_reading_date', 'unit']
export const ISSUE_FIELDS = ['name', 'subject', 'status', 'creation', 'customer', 'szikra_case_type', 'szikra_fields', 'szikra_created_by']
export const ACCESS_FIELDS = ['name', 'user_id', 'full_name', 'email', 'note', 'customer', 'role']

export const issueStatusToCase: Record<string, CaseStatus> = {
  'Open': 'uj', 'Replied': 'folyamatban', 'On Hold': 'visszajelzesre-var', 'Resolved': 'lezart', 'Closed': 'lezart',
}

export function mapPartner(c: any): Partner {
  return {
    id: c.szikra_id || c.name,
    name: c.customer_name,
    taxNumber: c.tax_id ?? '',
    address: c.szikra_address ?? '',
    segment: (c.szikra_segment || 'ipari') as Segment,
    contractNo: c.szikra_contract_no ?? '',
    ...(c.szikra_card_declines ? { cardDeclines: true } : {}),
  }
}

export function invoiceStatus(si: { outstanding_amount: number, due_date: string }, today = new Date().toISOString().slice(0, 10)): Invoice['status'] {
  if (!si.outstanding_amount) return 'paid'
  return si.due_date < today ? 'overdue' : 'open'
}

export function mapInvoice(si: any, partnerIdByCustomer: Map<string, string>, supplyIdByName?: Map<string, string>): Invoice {
  return {
    id: si.szikra_id || si.name,
    partnerId: partnerIdByCustomer.get(si.customer) ?? si.customer,
    ...(si.szikra_supply_point ? { supplyPointId: si.szikra_supply_point } : {}),
    period: si.szikra_period ?? si.posting_date,
    amountHuf: Math.round(si.grand_total),
    issueDate: si.posting_date,
    dueDate: si.due_date,
    status: invoiceStatus(si),
  }
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
      text: String(c.content ?? '').replace(/<[^>]+>/g, ''),
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
