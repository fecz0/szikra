import type { Invoice, Partner, ProductionRecord, Reading, SupplyPoint } from './types.ts'

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
/** Ft/kWh villany, tarifa szerint (valós nagyságrend: nem-lakossági, rendszerhasználati díjakkal) */
const ELEC_PRICE: Record<string, number> = { 'Ipari fix 2026': 61, 'Piaci követő': 58, 'Kereskedelmi csúcs-völgy': 64 }
const GAS_PRICE_PER_M3 = 335

export interface Bundle {
  partner: Partner
  supplyPoints: SupplyPoint[]
  readings: Reading[]
  invoices: Invoice[]
  production: ProductionRecord[]
}

/** Kereskedelmi lánc: több telephely, villany + (egy részén) gáz, 12 havi számla. */
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
      let cum = type === 'villany' ? 3_000_000 + Math.floor(r() * 900_000) : 400_000 + Math.floor(r() * 120_000)
      let last = cum; let lastDate = ''
      readings.push({ supplyPointId: spId, date: '2025-10-31', value: cum })
      for (const ym of MONTHS) {
        const noise = 0.94 + r() * 0.12
        const use = type === 'villany'
          ? round(s.elecMwh * 1000 * ELEC_SHAPE[monthIdx(ym)]! * noise)
          : round(s.elecMwh * 28 * GAS_SHAPE[monthIdx(ym)]! * noise)
        cum += use; last = cum; lastDate = lastDay(ym)
        readings.push({ supplyPointId: spId, date: lastDate, value: cum })
        const amount = type === 'villany' ? round(use * (ELEC_PRICE[s.tariff] ?? 60)) : round(use * GAS_PRICE_PER_M3)
        const issue = nextMonth5th(ym); const due = addDays(issue, 20)
        // egy telephely szeptemberi villanyszámlája lejárt (tartozás), az október végi számlák még nyitottak
        const overdue = s.city === 'Miskolc' && type === 'villany' && ym === '2026-09'
        const open = due >= REF_DATE || overdue
        invoices.push({ id: `${id}-INV-${spId.split('-').pop()}-${ym.replace('-', '')}`, partnerId: id, supplyPointId: spId, period: monthLabel(ym), amountHuf: amount, issueDate: issue, dueDate: due, status: open ? (due < REF_DATE ? 'overdue' : 'open') : 'paid' })
      }
      supplyPoints.push({ id: spId, partnerId: id, type, pod: `HU-DEMO-${type === 'villany' ? 'E' : 'G'}-${id.slice(-6)}-${si + 1}`, address: s.address, meterSerial: `${type === 'villany' ? 'E' : 'G'}-${5100 + si * 17}`, smart: type === 'villany', lastReading: last, lastReadingDate: lastDate, unit, label: s.label, tariff: type === 'villany' ? s.tariff : 'Gáz kereskedelmi' })
    }
  })
  return { partner, supplyPoints, readings, invoices, production: [] }
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
  return { partner, supplyPoints, readings, invoices: [], production }
}
