export type Segment = 'ipari' | 'kereskedelmi' | 'kozuzemi'
export type Role = 'admin' | 'penzugy' | 'muszaki' | 'olvaso'
export type Energy = 'villany' | 'gaz'
export type PartnerKind = 'fogyaszto' | 'termelo'

export interface Partner {
  id: string
  name: string
  taxNumber: string
  address: string
  segment: Segment
  /** fogyasztó (alapért.) vagy termelő (pl. napelempark) */
  kind?: PartnerKind
  contractNo: string
  /** Demó: a kártyaterhelést a bank elutasítja (hibaág) */
  cardDeclines?: boolean
}

/** Egy felhasználó egy cégnél betöltött szerepköre (CAP-03/04). */
export interface Membership {
  userId: string
  partnerId: string
  role: Role
}

export interface PortalUser {
  id: string
  name: string
  email: string
  note: string
}

export interface SupplyPoint {
  id: string
  partnerId: string
  type: Energy
  pod: string
  address: string
  meterSerial: string
  smart: boolean
  lastReading: number
  lastReadingDate: string
  unit: 'kWh' | 'm3'
  /** Telephely / blokk megnevezése (pl. „Debrecen áruház”, „A blokk”) */
  label?: string
  tariff?: string
  /** Termelő esetén a névleges teljesítmény */
  capacityKw?: number
  direction?: 'fogyasztas' | 'termeles'
}

/** Mérőállás-idősor egy pontja (kumulált állás a leolvasás napján). */
export interface Reading {
  supplyPointId: string
  date: string
  value: number
}

/** Havi termelés és az átvételi elszámolás (a partner nekünk számláz). */
export interface ProductionRecord {
  id: string
  partnerId: string
  supplyPointId: string
  /** ÉÉÉÉ-HH */
  month: string
  mwh: number
  priceHufPerMwh: number
  /** támogatási prémium (METÁR jellegű), Ft */
  premiumHuf: number
  /** kiegyenlítő energia költsége, levonás, Ft */
  imbalanceHuf: number
  /** fizetendő nekünk a partner felé: mwh*ár + prémium - kiegyenlítés */
  settlementHuf: number
  status: 'tervezet' | 'jovahagyva' | 'kifizetve'
}

export interface Invoice {
  id: string
  partnerId: string
  supplyPointId?: string
  period: string
  amountHuf: number
  issueDate: string
  dueDate: string
  status: 'open' | 'paid' | 'overdue'
}

/** Ügytípusok (UC-xx): a közös keretrendszer konfigurációja a `case-types.ts`-ben. */
export type CaseTypeId =
  | 'szamlareklamacio' | 'tartozasigazolas' | 'meroallas' | 'ajanlatkeres'
  | 'reszletfizetes' | 'dijcsomag' | 'uj-fogyasztasi-hely'
  | 'leallas-bejelentes' | 'kapacitas-modositas'

export type CaseStatus = 'uj' | 'folyamatban' | 'visszajelzesre-var' | 'lezart'

export interface CaseMessage {
  at: string
  by: string
  text: string
}

export interface CaseRecord {
  id: string
  partnerId: string
  type: CaseTypeId
  subject: string
  status: CaseStatus
  createdAt: string
  createdBy: string
  /** Az ügytípus egyedi mezői (pl. számlaazonosító, mérőállás) */
  fields: Record<string, string>
  messages: CaseMessage[]
}

export interface NotificationItem {
  id: string
  partnerId: string
  at: string
  text: string
  read: boolean
}

export interface AuditEntry {
  at: string
  userId: string
  partnerId: string
  action: string
}

/** Egy teljes demó-csomag: ez a seed és a JSON snapshot egysége is. */
export interface Dataset {
  partners: Partner[]
  users: PortalUser[]
  memberships: Membership[]
  supplyPoints: SupplyPoint[]
  readings: Reading[]
  production: ProductionRecord[]
  invoices: Invoice[]
  cases: CaseRecord[]
  notifications: NotificationItem[]
}

export const emptyDataset = (): Dataset => ({
  partners: [], users: [], memberships: [], supplyPoints: [], readings: [], production: [], invoices: [], cases: [], notifications: [],
})
