import type { Outage, Deal, ScheduleDay, ProductionRecord, Reading, AuditEntry, CaseMessage, CaseRecord, CaseTypeId, Dataset, Invoice, Membership, NotificationItem, Partner, PortalUser, SupplyPoint } from './types.ts'

export interface UserWithMemberships {
  user: PortalUser
  memberships: (Membership & { partner: Partner })[]
}

export class PaymentDeclined extends Error {}

/**
 * Az alkalmazás kizárólag ezen az interfészen át éri el a háttérrendszert (CRM/ERP).
 * `snapshot`: memória-tár, JSON snapshotból töltve (deploy, CI) — `erpnext`: élő ERPNext REST.
 */
export interface Backend {
  readonly kind: 'snapshot' | 'erpnext'
  listUsers: () => Promise<PortalUser[]>
  getUser: (userId: string) => Promise<UserWithMemberships | null>
  listInvoices: (partnerId: string) => Promise<Invoice[]>
  /** egy számla tételes számlaképpel (tételek, mérőadatok) */
  getInvoice: (partnerId: string, invoiceId: string) => Promise<Invoice | null>
  /** Fizetés; a PaymentDeclined hibával jelzi a bank elutasítását. */
  payInvoice: (partnerId: string, invoiceId: string, by: string) => Promise<void>
  listSupplyPoints: (partnerId: string) => Promise<SupplyPoint[]>
  listReadings: (partnerId: string) => Promise<Reading[]>
  listProduction: (partnerId: string) => Promise<ProductionRecord[]>
  listDeals: (partnerId: string) => Promise<Deal[]>
  /** Ügylet visszaigazolása (a partner elfogadja a kereskedői visszaigazolást). */
  confirmDeal: (partnerId: string, dealId: string, by: string) => Promise<void>
  listSchedule: (partnerId: string) => Promise<ScheduleDay[]>
  submitSchedule: (partnerId: string, day: { date: string, commodity: Deal['commodity'], values: number[], by: string }) => Promise<ScheduleDay>
  listOutages: (partnerId: string) => Promise<Outage[]>
  proposeOutage: (partnerId: string, input: { supplyPointId: string, kind: Outage['kind'], from: string, to: string, purpose: string, by: { userId: string, name: string } }) => Promise<Outage>
  /** Négy szem: jóváhagyás; a második, különböző jóváhagyó véglegesíti. Visszaadja a frissített leállást. */
  approveOutage: (partnerId: string, outageId: string, by: { userId: string, name: string }) => Promise<Outage>
  /** Egy hónap nagy összegű elszámolásainak jóváhagyása; a jóváhagyott rekordok számát adja. */
  approveSettlements: (partnerId: string, month: string, by: { userId: string, name: string }) => Promise<number>
  listCases: (partnerId: string) => Promise<CaseRecord[]>
  getCase: (partnerId: string, caseId: string) => Promise<CaseRecord | null>
  createCase: (input: { partnerId: string, type: CaseTypeId, subject: string, by: string, fields: Record<string, string> }) => Promise<CaseRecord>
  addMessage: (partnerId: string, caseId: string, msg: Omit<CaseMessage, 'at'>) => Promise<void>
  listNotifications: (partnerId: string) => Promise<NotificationItem[]>
  addAudit: (entry: Omit<AuditEntry, 'at'>) => Promise<void>
  listAudit: (partnerId: string) => Promise<AuditEntry[]>
  /** Csak snapshot módban: teszt-seed / visszaállítás. */
  load?: (dataset: Dataset, opts?: { pin?: boolean }) => void
  reset?: () => void
}

