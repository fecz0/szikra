import snapshot from '../../data/snapshot.json'
import type { Backend } from '../../domain/backend-types'
import { PaymentDeclined } from '../../domain/backend-types'
import { caseTypes } from '../../domain/case-types'
import type { AuditEntry, CaseRecord, Dataset } from '../../domain/types'
import { emptyDataset } from '../../domain/types'

// Nyilvános demón a seed végpont bárkinek elérhető: a memóriát korlátozzuk.
const MAX_PARTNERS = 500

/**
 * Memória-tár. A JSON snapshot (az ERPNext exportja) az induló állapot;
 * a módosítások (fizetés, új ügy) csak memóriában élnek, a `reset()` visszaállítja.
 */
export class MemoryBackend implements Backend {
  readonly kind = 'snapshot' as const
  private ds: Dataset = emptyDataset()
  private audit: AuditEntry[] = []
  private pinned = new Set<string>()
  private seq = 1

  constructor() {
    this.reset()
  }

  reset() {
    this.ds = { ...emptyDataset(), ...structuredClone(snapshot) } as unknown as Dataset
    this.audit = []
    this.pinned = new Set(this.ds.partners.map(p => p.id))
  }

  load(d: Dataset) {
    const c = structuredClone(d)
    this.ds.partners.push(...c.partners)
    this.ds.users.push(...c.users)
    this.ds.memberships.push(...c.memberships)
    this.ds.supplyPoints.push(...c.supplyPoints)
    this.ds.readings.push(...c.readings)
    this.ds.production.push(...c.production)
    this.ds.deals.push(...c.deals)
    this.ds.schedule.push(...c.schedule)
    this.ds.invoices.push(...c.invoices)
    this.ds.cases.push(...c.cases)
    this.ds.notifications.push(...c.notifications)
    // a legrégebbi, nem rögzített partnerek (és adataik) kiesnek
    const evict = this.ds.partners.filter(p => !this.pinned.has(p.id)).slice(0, Math.max(0, this.ds.partners.length - MAX_PARTNERS))
    if (evict.length) {
      const gone = new Set(evict.map(p => p.id))
      this.ds.partners = this.ds.partners.filter(p => !gone.has(p.id))
      this.ds.memberships = this.ds.memberships.filter(m => !gone.has(m.partnerId))
      this.ds.supplyPoints = this.ds.supplyPoints.filter(s => !gone.has(s.partnerId))
      this.ds.production = this.ds.production.filter(p => !gone.has(p.partnerId))
      this.ds.deals = this.ds.deals.filter(p => !gone.has(p.partnerId))
      this.ds.schedule = this.ds.schedule.filter(p => !gone.has(p.partnerId))
      const keepSp = new Set(this.ds.supplyPoints.map(s => s.id))
      this.ds.readings = this.ds.readings.filter(r => keepSp.has(r.supplyPointId))
      this.ds.invoices = this.ds.invoices.filter(i => !gone.has(i.partnerId))
      this.ds.cases = this.ds.cases.filter(i => !gone.has(i.partnerId))
    }
  }

  async listUsers() {
    return this.ds.users.filter(u => !u.id.startsWith('U-'))
  }

  async getUser(userId: string) {
    const user = this.ds.users.find(u => u.id === userId)
    if (!user) return null
    const memberships = this.ds.memberships
      .filter(m => m.userId === userId)
      .flatMap((m) => {
        const partner = this.ds.partners.find(p => p.id === m.partnerId)
        return partner ? [{ ...m, partner }] : []
      })
    return { user, memberships }
  }

  async listInvoices(partnerId: string) {
    return this.ds.invoices.filter(i => i.partnerId === partnerId)
  }

  async getInvoice(partnerId: string, invoiceId: string) {
    return this.ds.invoices.find(i => i.id === invoiceId && i.partnerId === partnerId) ?? null
  }

  async payInvoice(partnerId: string, invoiceId: string, by: string) {
    const inv = this.ds.invoices.find(i => i.id === invoiceId && i.partnerId === partnerId)
    if (!inv) throw createError({ statusCode: 404, message: 'A számla nem található' })
    if (inv.status === 'paid') throw createError({ statusCode: 409, message: 'A számla már ki van egyenlítve' })
    const partner = this.ds.partners.find(p => p.id === partnerId)
    if (partner?.cardDeclines) throw new PaymentDeclined()
    inv.status = 'paid'
    this.note(partnerId, `${inv.period} számla kiegyenlítve (${by})`)
  }

  async listSupplyPoints(partnerId: string) {
    return this.ds.supplyPoints.filter(s => s.partnerId === partnerId)
  }

  async listReadings(partnerId: string) {
    const ids = new Set(this.ds.supplyPoints.filter(s => s.partnerId === partnerId).map(s => s.id))
    return this.ds.readings.filter(r => ids.has(r.supplyPointId))
  }

  async listProduction(partnerId: string) {
    return this.ds.production.filter(p => p.partnerId === partnerId)
  }

  async listDeals(partnerId: string) {
    return this.ds.deals.filter(d => d.partnerId === partnerId).sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
  }

  async confirmDeal(partnerId: string, dealId: string, by: string) {
    const d = this.ds.deals.find(x => x.id === dealId && x.partnerId === partnerId)
    if (!d) throw createError({ statusCode: 404, message: 'Az ügylet nem található' })
    if (d.status !== 'visszaigazolasra-var') throw createError({ statusCode: 409, message: 'Az ügylet nem vár visszaigazolásra' })
    d.status = 'visszaigazolva'
    this.note(partnerId, `Ügylet visszaigazolva: ${d.product} (${by})`)
  }

  async listSchedule(partnerId: string) {
    return this.ds.schedule.filter(s => s.partnerId === partnerId).sort((a, b) => b.date.localeCompare(a.date))
  }

  async submitSchedule(partnerId: string, day: { date: string, commodity: 'villany' | 'gaz', values: number[], by: string }) {
    const id = `${partnerId}-SCH-${day.commodity === 'villany' ? 'E' : 'G'}-${day.date.replaceAll('-', '')}`
    let rec = this.ds.schedule.find(s => s.id === id)
    if (rec) { rec.values = day.values; rec.status = 'benyujtva'; rec.submittedBy = day.by }
    else { rec = { id, partnerId, date: day.date, commodity: day.commodity, values: day.values, status: 'benyujtva', submittedBy: day.by }; this.ds.schedule.push(rec) }
    this.note(partnerId, `Menetrend benyújtva: ${day.commodity === 'villany' ? 'villany' : 'gáz'}, ${day.date} (${day.by})`)
    return rec
  }

  async listCases(partnerId: string) {
    return this.ds.cases.filter(c => c.partnerId === partnerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getCase(partnerId: string, caseId: string) {
    return this.ds.cases.find(c => c.id === caseId && c.partnerId === partnerId) ?? null
  }

  async createCase(input: Parameters<Backend['createCase']>[0]) {
    const rec: CaseRecord = {
      id: `ÜGY-${String(this.seq++).padStart(5, '0')}-${crypto.randomUUID().slice(0, 4)}`,
      partnerId: input.partnerId,
      type: input.type,
      subject: input.subject,
      status: 'uj',
      createdAt: new Date().toISOString(),
      createdBy: input.by,
      fields: input.fields,
      messages: [],
    }
    this.ds.cases.push(rec)
    this.note(input.partnerId, `Új ügy: ${caseTypes[input.type].label}`)
    return rec
  }

  async addMessage(partnerId: string, caseId: string, msg: { by: string, text: string }) {
    const c = await this.getCase(partnerId, caseId)
    if (!c) throw createError({ statusCode: 404, message: 'Az ügy nem található' })
    c.messages.push({ ...msg, at: new Date().toISOString() })
  }

  async listNotifications(partnerId: string) {
    return this.ds.notifications.filter(n => n.partnerId === partnerId).sort((a, b) => b.at.localeCompare(a.at))
  }

  async addAudit(entry: Omit<AuditEntry, 'at'>) {
    this.audit.push({ ...entry, at: new Date().toISOString() })
  }

  async listAudit(partnerId: string) {
    return this.audit.filter(a => a.partnerId === partnerId).reverse()
  }

  private note(partnerId: string, text: string) {
    this.ds.notifications.push({ id: `N-${this.seq++}`, partnerId, at: new Date().toISOString(), text, read: false })
  }
}
