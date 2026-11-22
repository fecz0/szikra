export type Segment = 'ipari' | 'kereskedelmi' | 'kozuzemi'
export type Role = 'admin' | 'penzugy' | 'muszaki' | 'olvaso' | 'kereskedo' | 'megfelelo'
export type Energy = 'villany' | 'gaz'
export type PartnerKind = 'fogyaszto' | 'termelo' | 'kereskedo'

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
  /** Nagykereskedelmi partner: hitelkeret, bankgarancia és lejárata */
  creditLimitHuf?: number
  guaranteeHuf?: number
  guaranteeExpiry?: string
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
  /** szerződött teljesítmény (kW villany) és hálózati kategória (pl. „KIF III.”) */
  contractedKw?: number
  networkCategory?: string
}

/** Mérőállás-idősor egy pontja (kumulált állás a leolvasás napján). */
export interface Reading {
  supplyPointId: string
  date: string
  value: number
}

export type Commodity = 'villany' | 'gaz'
export type DealStatus = 'visszaigazolasra-var' | 'visszaigazolva' | 'vitatott' | 'teljesitve'

/** Nagykereskedelmi ügylet (határidős energiakereskedelem). */
export interface Deal {
  id: string
  partnerId: string
  commodity: Commodity
  /** pl. „Bázis”, „Csúcs”, „Gáz bázis” */
  product: string
  /** vétel: a partner vesz tőlünk; eladás: a partner ad el nekünk */
  side: 'vetel' | 'eladas'
  /** villany: MW, gáz: MWh/nap */
  volume: number
  volumeUnit: 'MW' | 'MWh/nap'
  priceEurMwh: number
  fxHufPerEur: number
  deliveryFrom: string
  deliveryTo: string
  /** a teljes időszak mennyisége, MWh */
  totalMwh: number
  tradeDate: string
  status: DealStatus
}

/** Napi menetrend (nominálás): villany óránként MW (24 érték), gáz napi MWh (1 érték). */
export interface ScheduleDay {
  id: string
  partnerId: string
  date: string
  commodity: Commodity
  values: number[]
  status: 'benyujtva' | 'elfogadva'
  submittedBy: string
}

/** Egy jóváhagyás (négy szem elve: két különböző személy kell). */
export interface Approval {
  userId: string
  name: string
  at: string
}

/** Blokk-leállás (üzemanyagcsere, karbantartás, rendkívüli leállás). */
export interface Outage {
  id: string
  partnerId: string
  supplyPointId: string
  kind: 'tervezett' | 'rendkivuli'
  from: string
  to: string
  purpose: string
  proposedBy: { userId: string, name: string }
  status: 'jovahagyasra-var' | 'jovahagyva'
  approvals: Approval[]
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
  /** nagy összegű elszámolásnál (lásd approvals.ts) a két jóváhagyás */
  approvals?: Approval[]
}

/** A számla egy tétele (számlakép): energia, rendszerhasználati díj, pénzeszköz/adó. Nettó összeg. */
export interface InvoiceLine {
  code: string
  label: string
  category: 'energia' | 'rendszerhasznalat' | 'penzeszkoz-ado'
  quantity: number
  unit: string
  unitPrice: number
  amountHuf: number
}

/** Mérőadatok az elszámolási időszakra. */
export interface InvoiceUsage {
  periodFrom: string
  periodTo: string
  prevReading: number
  currReading: number
  total: number
  unit: 'kWh' | 'm3'
  /** villany: zónánkénti fogyasztás (nappali 6–17, csúcs 17–22, völgy 22–6) */
  zones?: { nappali: number, csucs: number, volgy: number }
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
  /** tételes számlakép (nettó tételek); az amountHuf a bruttó végösszeg */
  lines?: InvoiceLine[]
  usage?: InvoiceUsage
}

/** Ügytípusok (UC-xx): a közös keretrendszer konfigurációja a `case-types.ts`-ben. */
export type CaseTypeId =
  | 'ugylet-vita' | 'menetrend-modositas'
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
  deals: Deal[]
  schedule: ScheduleDay[]
  outages: Outage[]
  audit: AuditEntry[]
  invoices: Invoice[]
  cases: CaseRecord[]
  notifications: NotificationItem[]
}

export const emptyDataset = (): Dataset => ({
  partners: [], users: [], memberships: [], supplyPoints: [], readings: [], production: [], deals: [], schedule: [], outages: [], audit: [], invoices: [], cases: [], notifications: [],
})
