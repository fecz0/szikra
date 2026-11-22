import { electricityLines, gasLines, totals } from './tariffs.ts'
import type { NetworkCategory, Zones } from './tariffs.ts'
import type { AuditEntry, Outage, Deal, Invoice, InvoiceLine, Partner, ProductionRecord, Reading, ScheduleDay, SupplyPoint } from './types.ts'

/**
 * Determinista demó-adatgenerátor: 12 hónap számla, mérőállás és termelés valós nagyságrendű árakkal.
 * Ugyanazt használja az ERPNext seed, az offline snapshot és a tesztek; a véletlen a partner azonosítójából jön,
 * így minden futás ugyanazt az adatot adja.
 */

/** Az utolsó lezárt hónap utáni nap: a számlák "ma" állapota ehhez képest értendő. */
export const REF_DATE = '2026-11-22'
/** A 12 hónap: 2025-11 … 2026-10 */
export const MONTHS = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'] as const

const HU_MONTH = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
export const monthLabel = (ym: string) => `${ym.slice(0, 4)}. ${HU_MONTH[Number(ym.slice(5)) - 1]}`
const lastDay = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)
const nextMonth5th = (ym: string) => addDays(lastDay(ym), 5)

function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  let a = h >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const round = (n: number, step = 1) => Number((Math.round(n / step) * step).toFixed(step < 1 ? 1 : 0))

/** Havi fogyasztási profil (1 = átlag): villany kicsit nyáron (hűtés) és télen (világítás) magasabb, gáz télen sokszoros. */
const ELEC_SHAPE = [1.06, 1.08, 1.1, 1.02, 0.97, 0.94, 0.95, 1.02, 1.08, 1.06, 0.97, 0.98]
const GAS_SHAPE = [2.6, 3.2, 3.5, 3.0, 2.2, 1.1, 0.5, 0.3, 0.3, 0.4, 0.9, 1.8]
const monthIdx = (ym: string) => Number(ym.slice(5)) - 1

interface Site { label: string, city: string, address: string, elecMwh: number, gas?: boolean, tariff: string }

const CHAIN_SITES: Site[] = [
  { label: 'Debrecen áruház', city: 'Debrecen', address: '4025 Debrecen, Piac utca 12.', elecMwh: 96, gas: true, tariff: 'Ipari fix 2026' },
  { label: 'Szeged áruház', city: 'Szeged', address: '6720 Szeged, Kárász utca 4.', elecMwh: 88, gas: true, tariff: 'Ipari fix 2026' },
  { label: 'Győr áruház', city: 'Győr', address: '9021 Győr, Baross út 30.', elecMwh: 74, tariff: 'Piaci követő' },
  { label: 'Pécs áruház', city: 'Pécs', address: '7621 Pécs, Király utca 8.', elecMwh: 69, tariff: 'Piaci követő' },
  { label: 'Miskolc áruház', city: 'Miskolc', address: '3525 Miskolc, Széchenyi u. 21.', elecMwh: 82, gas: true, tariff: 'Kereskedelmi csúcs-völgy' },
  { label: 'Nyíregyháza áruház', city: 'Nyíregyháza', address: '4400 Nyíregyháza, Dohány u. 3.', elecMwh: 61, gas: true, tariff: 'Kereskedelmi csúcs-völgy' },
  { label: 'Székesfehérvár áruház', city: 'Székesfehérvár', address: '8000 Székesfehérvár, Fő u. 15.', elecMwh: 72, tariff: 'Ipari fix 2026' },
  { label: 'Kecskemét áruház', city: 'Kecskemét', address: '6000 Kecskemét, Kossuth tér 2.', elecMwh: 58, tariff: 'Piaci követő' },
]

export interface Bundle {
  partner: Partner
  supplyPoints: SupplyPoint[]
  readings: Reading[]
  invoices: Invoice[]
  production: ProductionRecord[]
  deals: Deal[]
  schedule: ScheduleDay[]
  outages?: Outage[]
  audit?: AuditEntry[]
}

/** Kereskedelmi lánc: több telephely, villany + (egy részén) gáz, 12 havi tételes számla (valós díjszerkezet, lásd tariffs.ts). */
export function buildChain(id: string, name: string, siteCount = CHAIN_SITES.length): Bundle {
  const r = rng(id)
  const partner: Partner = { id, name, taxNumber: '25678123-2-13', address: '4025 Debrecen, Piac utca 12.', segment: 'kereskedelmi', contractNo: `SZ-${id}-05` }
  const supplyPoints: SupplyPoint[] = []; const readings: Reading[] = []; const invoices: Invoice[] = []
  const sites = CHAIN_SITES.slice(0, siteCount)
  sites.forEach((s, si) => {
    const kinds: Array<'villany' | 'gaz'> = s.gas ? ['villany', 'gaz'] : ['villany']
    for (const type of kinds) {
      const spId = `${id}-${type === 'villany' ? 'E' : 'G'}${si + 1}`
      const unit = type === 'villany' ? 'kWh' as const : 'm3' as const
      // a nagyobb telephelyek KIF III. (idősoros, lekötött teljesítménnyel), a kisebbek KIF IV. (okos mérős)
      const category: NetworkCategory = s.elecMwh >= 80 ? 'KIF III.' : 'KIF IV.'
      const contractedKw = Math.round(s.elecMwh * 1000 / 730 * 2.2 / 10) * 10
      const contractedKwhH = Math.round(s.elecMwh * 0.9)
      let cum = type === 'villany' ? 3_000_000 + Math.floor(r() * 900_000) : 400_000 + Math.floor(r() * 120_000)
      let last = cum; let lastDate = ''
      readings.push({ supplyPointId: spId, date: '2025-10-31', value: cum })
      for (const ym of MONTHS) {
        const noise = 0.94 + r() * 0.12
        const use = type === 'villany'
          ? round(s.elecMwh * 1000 * ELEC_SHAPE[monthIdx(ym)]! * noise, 100)
          : round(s.elecMwh * 28 * GAS_SHAPE[monthIdx(ym)]! * noise, 5)
        const prev = cum
        cum += use; last = cum; lastDate = lastDay(ym)
        readings.push({ supplyPointId: spId, date: lastDate, value: cum })

        // zónák (nappali 6–17, csúcs 17–22, völgy 22–6): a boltok nappal és este fogyasztanak többet
        let zones: Zones | undefined
        let lines
        if (type === 'villany') {
          const nap = round(use * (0.52 + r() * 0.06), 100); const csucs = round(use * (0.24 + r() * 0.04), 100)
          zones = { nappali: nap, csucs, volgy: use - nap - csucs }
          lines = electricityLines({ zones, tariff: s.tariff, hupxHufPerMwh: BASE_PRICE_HUF_MWH[monthIdx(ym)]!, contractedKw, category })
        }
        else {
          lines = gasLines({ m3: use, contractedKwhH })
        }
        const t = totals(lines)
        const issue = nextMonth5th(ym); const due = addDays(issue, 20)
        // egy telephely szeptemberi villanyszámlája lejárt (tartozás), az október végi számlák még nyitottak
        const overdue = s.city === 'Miskolc' && type === 'villany' && ym === '2026-09'
        const open = due >= REF_DATE || overdue
        const first = `${ym}-01`
        invoices.push({
          id: `${id}-INV-${spId.split('-').pop()}-${ym.replace('-', '')}`, partnerId: id, supplyPointId: spId, period: monthLabel(ym),
          amountHuf: t.gross, issueDate: issue, dueDate: due, status: open ? (due < REF_DATE ? 'overdue' : 'open') : 'paid',
          lines, usage: { periodFrom: first, periodTo: lastDate, prevReading: prev, currReading: cum, total: use, unit, ...(zones ? { zones } : {}) },
        })
      }
      supplyPoints.push({
        id: spId, partnerId: id, type, pod: `HU-DEMO-${type === 'villany' ? 'E' : 'G'}-${id.slice(-6)}-${si + 1}`, address: s.address,
        meterSerial: `${type === 'villany' ? 'E' : 'G'}-${5100 + si * 17}`, smart: type === 'villany', lastReading: last, lastReadingDate: lastDate,
        unit, label: s.label, tariff: type === 'villany' ? s.tariff : 'Gáz kereskedelmi',
        ...(type === 'villany' ? { contractedKw, networkCategory: category } : { contractedKw: contractedKwhH, networkCategory: 'Gáz elosztás' }),
      })
    }
  })
  return { partner, supplyPoints, readings, invoices, production: [], deals: [], schedule: [] }
}

/** Napenergia: havi termelés a névleges teljesítményből, szezonális alakkal. */
const SOLAR_SHARE = [3, 5, 8, 10.5, 12, 12.5, 13, 12, 9.5, 6.5, 3.5, 2.5] // % éves hozam, index 0 = január (összeg 100)
const BASE_PRICE_HUF_MWH = [46000, 44000, 38000, 33000, 30000, 31000, 36000, 37000, 38000, 41000, 45000, 48000] // HUPX-jellegű havi átlag, Ft/MWh

export function buildSolarPark(id: string, name: string, blocks: Array<{ label: string, mw: number, premium: number }> = [{ label: 'A blokk', mw: 12, premium: 0 }, { label: 'B blokk', mw: 8, premium: 4500 }]): Bundle {
  const r = rng(id)
  const partner: Partner = { id, name, taxNumber: '28345671-2-04', address: '5000 Szolnok, Napsugár út 1.', segment: 'ipari', kind: 'termelo', contractNo: `SZ-${id}-06` }
  const supplyPoints: SupplyPoint[] = []; const readings: Reading[] = []; const production: ProductionRecord[] = []
  blocks.forEach((b, bi) => {
    const spId = `${id}-T${bi + 1}`
    let cum = 8_000_000 + Math.floor(r() * 1_000_000)
    let lastDate = ''
    readings.push({ supplyPointId: spId, date: '2025-10-31', value: Math.round(cum) })
    for (const ym of MONTHS) {
      const mi = monthIdx(ym)
      const annualMwh = b.mw * 1250
      const mwh = round(annualMwh * (SOLAR_SHARE[mi]! / 100) * (0.92 + r() * 0.16), 0.1)
      const capture = mi >= 3 && mi <= 8 ? 0.78 : 0.9 // napsütéses órák alacsonyabb piaci ára
      const price = round(BASE_PRICE_HUF_MWH[mi]! * capture, 10)
      const energyValue = Math.round(mwh * price)
      const imbalance = Math.round(energyValue * 0.025)
      const premium = Math.round(mwh * b.premium)
      cum += mwh * 1000; lastDate = lastDay(ym)
      readings.push({ supplyPointId: spId, date: lastDate, value: Math.round(cum) })
      const status: ProductionRecord['status'] = ym <= '2026-08' ? 'kifizetve' : ym === '2026-09' ? 'jovahagyva' : 'tervezet'
      production.push({ id: `${spId}-${ym.replace('-', '')}`, partnerId: id, supplyPointId: spId, month: ym, mwh, priceHufPerMwh: price, premiumHuf: premium, imbalanceHuf: imbalance, settlementHuf: energyValue + premium - imbalance, status })
    }
    supplyPoints.push({ id: spId, partnerId: id, type: 'villany', pod: `HU-DEMO-T-${id.slice(-6)}-${bi + 1}`, address: partner.address, meterSerial: `T-${2200 + bi * 31}`, smart: true, lastReading: Math.round(cum), lastReadingDate: lastDate, unit: 'kWh', label: `${b.label} (${b.mw} MW)`, tariff: b.premium ? 'Átvétel + támogatási prémium' : 'Piaci átvétel', capacityKw: b.mw * 1000, direction: 'termeles' })
  })
  return { partner, supplyPoints, readings, invoices: [], production, deals: [], schedule: [] }
}

// ---------------------------------------------------------------------------------------------
// Nagykereskedelem: határidős ügyletek, napi menetrend, hitelkeret; havi elszámoló számlák (valós nagyságrend)
// ---------------------------------------------------------------------------------------------

const dayMs = 86_400_000
const eachDay = (from: string, to: string) => { const out: string[] = []; for (let t = Date.parse(from); t <= Date.parse(to); t += dayMs) out.push(new Date(t).toISOString().slice(0, 10)); return out }
const isWeekday = (iso: string) => { const d = new Date(iso + 'T00:00:00Z').getUTCDay(); return d >= 1 && d <= 5 }
const overlap = (a0: string, a1: string, b0: string, b1: string) => { const f = a0 > b0 ? a0 : b0; const t = a1 < b1 ? a1 : b1; return f <= t ? eachDay(f, t) : [] }

/** Egy ügylet mennyisége (MWh) egy időablakban: bázis = MW × 24 h, csúcs = MW × 12 h hétköznap, gáz = MWh/nap. */
export function dealMwh(d: Pick<Deal, 'commodity' | 'product' | 'volume'>, from: string, to: string): number {
  const days = eachDay(from, to)
  if (d.commodity === 'gaz') return d.volume * days.length
  if (d.product === 'Csúcs') return d.volume * 12 * days.filter(isWeekday).length
  return d.volume * 24 * days.length
}

interface DealSpec { key: string, commodity: Deal['commodity'], product: string, side: Deal['side'], volume: number, price: number, fx: number, from: string, to: string, trade: string, status: Deal['status'], code?: string }

const DEAL_SPECS: DealSpec[] = [
  { key: '01', commodity: 'villany', product: 'Bázis', side: 'vetel', volume: 25, price: 96.4, fx: 395, from: '2025-11-01', to: '2026-12-31', trade: '2025-09-12', status: 'visszaigazolva', code: 'NK-BAZIS' },
  { key: '02', commodity: 'villany', product: 'Csúcs', side: 'vetel', volume: 10, price: 112, fx: 395, from: '2025-11-01', to: '2026-12-31', trade: '2025-09-12', status: 'visszaigazolva', code: 'NK-CSUCS' },
  { key: '03', commodity: 'gaz', product: 'Gáz bázis', side: 'vetel', volume: 60, price: 37.5, fx: 395, from: '2025-11-01', to: '2026-12-31', trade: '2025-09-15', status: 'visszaigazolva', code: 'NK-GAZ' },
  { key: '04', commodity: 'villany', product: 'Bázis', side: 'vetel', volume: 20, price: 98.5, fx: 392, from: '2026-07-01', to: '2026-09-30', trade: '2026-05-18', status: 'teljesitve', code: 'NK-BAZIS-NEGYED' },
  { key: '05', commodity: 'villany', product: 'Csúcs', side: 'vetel', volume: 10, price: 109, fx: 392, from: '2026-07-01', to: '2026-09-30', trade: '2026-05-18', status: 'teljesitve', code: 'NK-CSUCS-NEGYED' },
  { key: '06', commodity: 'villany', product: 'Bázis', side: 'vetel', volume: 40, price: 109, fx: 396, from: '2027-01-01', to: '2027-03-31', trade: '2026-10-20', status: 'visszaigazolva' },
  { key: '07', commodity: 'villany', product: 'Bázis', side: 'vetel', volume: 30, price: 104.5, fx: 397, from: '2027-04-01', to: '2027-06-30', trade: '2026-11-20', status: 'visszaigazolasra-var' },
  { key: '08', commodity: 'villany', product: 'Csúcs', side: 'vetel', volume: 10, price: 121, fx: 397, from: '2027-01-01', to: '2027-03-31', trade: '2026-11-21', status: 'visszaigazolasra-var' },
  { key: '09', commodity: 'villany', product: 'Bázis', side: 'eladas', volume: 15, price: 101.3, fx: 396, from: '2026-11-01', to: '2026-12-31', trade: '2026-10-28', status: 'visszaigazolva' },
  { key: '10', commodity: 'villany', product: 'Csúcs', side: 'vetel', volume: 5, price: 119, fx: 396, from: '2026-12-01', to: '2026-12-31', trade: '2026-11-12', status: 'vitatott' },
  { key: '11', commodity: 'gaz', product: 'Gáz téli szezon', side: 'vetel', volume: 100, price: 38.5, fx: 396, from: '2026-11-01', to: '2027-03-31', trade: '2026-10-05', status: 'visszaigazolva' },
  { key: '12', commodity: 'gaz', product: 'Gáz bázis', side: 'vetel', volume: 80, price: 34.2, fx: 397, from: '2027-04-01', to: '2027-06-30', trade: '2026-11-19', status: 'visszaigazolasra-var' },
]

const INVOICE_LABELS: Record<string, string> = {
  'NK-BAZIS': 'Villamos energia, bázis', 'NK-CSUCS': 'Villamos energia, csúcs', 'NK-GAZ': 'Földgáz, bázis',
  'NK-BAZIS-NEGYED': 'Villamos energia, bázis (negyedéves)', 'NK-CSUCS-NEGYED': 'Villamos energia, csúcs (negyedéves)',
}
export const WHOLESALE_LINE_LABELS = INVOICE_LABELS

export function buildWholesale(id: string, name: string): Bundle {
  const partner: Partner = {
    id, name, taxNumber: '24987654-2-41', address: '1138 Budapest, Dunavirág utca 2.', segment: 'kereskedelmi', kind: 'kereskedo',
    contractNo: `SZ-${id}-07`, creditLimitHuf: 3_000_000_000, guaranteeHuf: 1_500_000_000, guaranteeExpiry: '2027-02-28',
  }
  const deals: Deal[] = DEAL_SPECS.map(d => ({
    id: `${id}-D${d.key}`, partnerId: id, commodity: d.commodity, product: d.product, side: d.side, volume: d.volume,
    volumeUnit: d.commodity === 'gaz' ? 'MWh/nap' : 'MW', priceEurMwh: d.price, fxHufPerEur: d.fx, deliveryFrom: d.from, deliveryTo: d.to,
    totalMwh: dealMwh({ commodity: d.commodity, product: d.product, volume: d.volume }, d.from, d.to), tradeDate: d.trade, status: d.status,
  }))

  // havi elszámoló számlák: a vételi ügyletek leszállított mennyisége × ár (HUF/MWh = EUR ár × árfolyam)
  const invoices: Invoice[] = []
  for (const ym of MONTHS) {
    const from = `${ym}-01`; const to = lastDay(ym)
    const lines: InvoiceLine[] = []
    for (const spec of DEAL_SPECS) {
      if (!spec.code || spec.side !== 'vetel') continue
      const days = overlap(spec.from, spec.to, from, to)
      if (!days.length) continue
      const mwh = dealMwh({ commodity: spec.commodity, product: spec.product, volume: spec.volume }, days[0]!, days.at(-1)!)
      const unitPrice = Math.round(spec.price * spec.fx)
      lines.push({ code: spec.code, label: INVOICE_LABELS[spec.code]!, category: 'energia', quantity: mwh, unit: 'MWh', unitPrice, amountHuf: mwh * unitPrice })
    }
    const t = totals(lines)
    const issue = nextMonth5th(ym); const due = addDays(issue, 20)
    invoices.push({ id: `${id}-INV-${ym.replace('-', '')}`, partnerId: id, period: monthLabel(ym), amountHuf: t.gross, issueDate: issue, dueDate: due, status: due >= REF_DATE ? 'open' : 'paid', lines })
  }

  // napi menetrend: az elmúlt hét és a mai nap; a holnapi hiányzik (azt a partner nyújtja be)
  const schedule: ScheduleDay[] = []
  for (const date of eachDay(addDays(REF_DATE, -7), REF_DATE)) {
    const peak = isWeekday(date)
    schedule.push({ id: `${id}-SCH-E-${date.replaceAll('-', '')}`, partnerId: id, date, commodity: 'villany', values: Array.from({ length: 24 }, (_, h) => 25 + (peak && h >= 8 && h < 20 ? 10 : 0)), status: 'elfogadva', submittedBy: 'Varga Dávid' })
    schedule.push({ id: `${id}-SCH-G-${date.replaceAll('-', '')}`, partnerId: id, date, commodity: 'gaz', values: [160], status: 'elfogadva', submittedBy: 'Varga Dávid' })
  }
  return { partner, supplyPoints: [], readings: [], invoices, production: [], deals, schedule }
}

// ---------------------------------------------------------------------------------------------
// Paks-jellegű bázistermelő: 4 blokk × 500 MW, váltakozó éves leállások, hosszú távú vételi szerződés,
// nagy összegű havi elszámolás kétszemélyes (négy szem) jóváhagyással
// ---------------------------------------------------------------------------------------------

export const ATOM_USERS = {
  vezeto: { userId: 'DEMO-ATOMVEZETO', name: 'Dr. Horváth Péter' },
  megfelelo: { userId: 'DEMO-MEGFELELO', name: 'Kovács Judit' },
  uzem: { userId: 'DEMO-ATOMUZEM', name: 'Gál Tibor' },
  penz: { userId: 'DEMO-ELSZAMOLAS', name: 'Szűcs Réka' },
} as const

const PPA_PRICE_HUF_MWH = 33_500 // hosszú távú vételi szerződés, fix ár (demó-érték)
const BLOCK_MW = 500

const approvedAt = (iso: string, plusDays = 0) => `${addDays(iso, plusDays)}T09:30:00.000Z`

export function buildNuclear(id: string, name: string): Bundle {
  const r = rng(id)
  const partner: Partner = { id, name, taxNumber: '10456789-2-17', address: '7030 Paks, Dunai út 4.', segment: 'ipari', kind: 'termelo', contractNo: `SZ-${id}-08` }
  const blocks = [1, 2, 3, 4].map(i => ({ i, spId: `${id}-T${i}` }))
  const O = (n: number, block: number, kind: Outage['kind'], from: string, to: string, purpose: string, status: Outage['status'], approvals: Array<keyof typeof ATOM_USERS>, proposedAt: string): Outage => ({
    id: `${id}-OUT-${String(n).padStart(2, '0')}`, partnerId: id, supplyPointId: `${id}-T${block}`, kind, from, to, purpose, proposedBy: ATOM_USERS.uzem, status,
    approvals: approvals.map((k, j) => ({ ...ATOM_USERS[k], at: approvedAt(proposedAt, j + 1) })),
  })
  const FUEL = 'Üzemanyagcsere és időszakos karbantartás'
  const outages: Outage[] = [
    O(1, 1, 'tervezett', '2026-03-14', '2026-04-22', FUEL, 'jovahagyva', ['vezeto', 'megfelelo'], '2025-12-10'),
    O(2, 2, 'tervezett', '2026-05-09', '2026-06-23', FUEL, 'jovahagyva', ['vezeto', 'megfelelo'], '2026-01-12'),
    O(3, 3, 'tervezett', '2026-08-15', '2026-09-28', FUEL, 'jovahagyva', ['vezeto', 'megfelelo'], '2026-03-16'),
    O(4, 4, 'tervezett', '2026-10-10', '2026-11-20', FUEL, 'jovahagyva', ['megfelelo', 'vezeto'], '2026-05-18'),
    O(5, 1, 'tervezett', '2027-03-20', '2027-04-28', FUEL, 'jovahagyasra-var', ['vezeto'], '2026-11-16'),
    O(6, 2, 'tervezett', '2027-05-15', '2027-06-30', FUEL, 'jovahagyasra-var', [], '2026-11-20'),
    O(7, 3, 'tervezett', '2027-08-10', '2027-09-25', FUEL, 'jovahagyva', ['vezeto', 'megfelelo'], '2026-10-05'),
    O(8, 2, 'rendkivuli', '2026-12-02', '2026-12-04', 'Hűtővíz-szivattyú javítása', 'jovahagyasra-var', [], '2026-11-21'),
  ]
  const outageDays = (spId: string, ym: string) => outages.filter(o => o.supplyPointId === spId && o.status === 'jovahagyva').reduce((s, o) => s + overlap(o.from, o.to, `${ym}-01`, lastDay(ym)).length, 0)

  const supplyPoints: SupplyPoint[] = []; const readings: Reading[] = []; const production: ProductionRecord[] = []
  for (const b of blocks) {
    let cum = 18_000_000_000 + Math.floor(r() * 2_000_000_000)
    readings.push({ supplyPointId: b.spId, date: '2025-10-31', value: cum })
    let lastDate = ''
    for (const ym of MONTHS) {
      const days = eachDay(`${ym}-01`, lastDay(ym)).length
      const avail = 1 - outageDays(b.spId, ym) / days
      const mwh = Math.round(BLOCK_MW * days * 24 * avail * (0.984 + r() * 0.012))
      const energyValue = mwh * PPA_PRICE_HUF_MWH
      const imbalance = Math.round(energyValue * 0.004)
      cum += mwh * 1000; lastDate = lastDay(ym)
      readings.push({ supplyPointId: b.spId, date: lastDate, value: cum })
      const base = nextMonth5th(ym)
      const both = [{ ...ATOM_USERS.penz, at: approvedAt(base, 1) }, { ...ATOM_USERS.vezeto, at: approvedAt(base, 2) }]
      const status: ProductionRecord['status'] = ym <= '2026-08' ? 'kifizetve' : ym === '2026-09' ? 'jovahagyva' : 'tervezet'
      production.push({
        id: `${b.spId}-${ym.replace('-', '')}`, partnerId: id, supplyPointId: b.spId, month: ym, mwh, priceHufPerMwh: PPA_PRICE_HUF_MWH,
        premiumHuf: 0, imbalanceHuf: imbalance, settlementHuf: energyValue - imbalance, status,
        approvals: status === 'tervezet' ? [both[0]!] : both,
      })
    }
    supplyPoints.push({
      id: b.spId, partnerId: id, type: 'villany', pod: `HU-DEMO-T-${id.slice(-5)}-${b.i}`, address: partner.address, meterSerial: `T-${7000 + b.i * 13}`, smart: true,
      lastReading: cum, lastReadingDate: lastDate, unit: 'kWh', label: `Blokk ${b.i} (${BLOCK_MW} MW)`, tariff: 'Hosszú távú PPA (fix ár)', capacityKw: BLOCK_MW * 1000, direction: 'termeles',
    })
  }

  // auditnapló: az elmúlt napok eseményei (a valós működés szemléltetésére)
  const ev = (daysAgo: number, hh: string, u: { userId: string, name?: string }, action: string): AuditEntry => ({ at: `${addDays(REF_DATE, -daysAgo)}T${hh}:00.000Z`, userId: u.userId, partnerId: id, action })
  const audit: AuditEntry[] = [
    ev(7, '07:58', ATOM_USERS.uzem, 'belépés'),
    ev(6, '08:12', ATOM_USERS.penz, 'átvételi elszámolás jóváhagyva (1/2): 2026-09'),
    ev(5, '09:03', ATOM_USERS.vezeto, 'átvételi elszámolás jóváhagyva (2/2): 2026-09'),
    ev(5, '13:40', ATOM_USERS.uzem, `leállás javasolva: ${id}-OUT-05`),
    ev(4, '10:22', ATOM_USERS.vezeto, `leállás jóváhagyva (1/2): ${id}-OUT-05`),
    ev(3, '08:47', ATOM_USERS.penz, 'átvételi elszámolás jóváhagyva (1/2): 2026-10'),
    ev(2, '11:05', ATOM_USERS.uzem, `leállás javasolva: ${id}-OUT-06`),
    ev(1, '14:31', ATOM_USERS.uzem, `leállás javasolva: ${id}-OUT-08`),
    ev(1, '15:02', ATOM_USERS.megfelelo, 'belépés'),
  ]
  return { partner, supplyPoints, readings, invoices: [], production, deals: [], schedule: [], outages, audit }
}
