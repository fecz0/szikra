import { FIX_PRICE, TRADER_MARGIN, ZONE_PRICE, hupxBase } from './tariffs.ts'
import type { IntervalData, TariffDef } from './types.ts'

/**
 * Tarifa-motor: egy díjcsomag energiadíját számolja ki intervallum-mérőadatból. A számítás ugyanazt a kerekítést
 * használja, mint a számlázás (tételenként forintra), így a jelenlegi díjcsomaggal a ténylegesen kiszámlázott
 * energiadíjat adja vissza; ez a motor helyességének próbája (lásd tests/unit/pricing.test.ts).
 * A rendszerhasználati díj, a pénzeszközök és az adók díjcsomagtól függetlenek, ezért az összehasonlítás az energiadíjra szól.
 */

export const SYSTEM_TARIFFS: TariffDef[] = [
  { id: 'SYS-FIX', name: 'Ipari fix 2026', kind: 'fix', fixHufPerKwh: FIX_PRICE, system: true },
  // demó-termék: hosszabb kötésért kedvezményes fix ár (a kereskedő kockázati felárat spórol)
  { id: 'SYS-FIX27', name: 'Ipari fix 2027 (12 hó kötés)', kind: 'fix', fixHufPerKwh: 36.9, system: true },
  { id: 'SYS-PIACI', name: 'Piaci követő', kind: 'indexed', marginHufPerKwh: TRADER_MARGIN, system: true },
  { id: 'SYS-CSV', name: 'Kereskedelmi csúcs-völgy', kind: 'tou', zoneHufPerKwh: ZONE_PRICE, system: true },
  { id: 'SYS-DIN', name: 'Dinamikus (óránkénti tőzsdei)', kind: 'dynamic', marginHufPerKwh: 2.4, system: true },
]

export const kindLabel: Record<TariffDef['kind'], string> = {
  fix: 'Fix ár', indexed: 'Tőzsdei havi átlag + díj', tou: 'Csúcs-völgy (zónás)', dynamic: 'Dinamikus (óránkénti tőzsdei ár)',
}

/** zónaidők: nappali 6–17, csúcs 17–22, völgy 22–6 */
export const zoneOfHour = (h: number): 'nappali' | 'csucs' | 'volgy' => (h >= 6 && h < 17 ? 'nappali' : h >= 17 && h < 22 ? 'csucs' : 'volgy')
export const daysInMonth = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate()
const weekdayOf = (ym: string, day: number) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, day)).getUTCDay()

function prng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296 }
}

/**
 * Órás tőzsdei ár (Ft/kWh) egy hónapra, determinista modell: éjjel olcsóbb, nyáron délben a napelemek leviszik az árat,
 * este csúcs; hétvégén alacsonyabb. A havi ÁTLAGA pontosan megegyezik a havi HUPX-átlaggal, így a „Piaci követő”
 * és a dinamikus díjcsomag ugyanarról az árszintről indul; a különbséget a fogyasztási profil okozza.
 */
export function hourlyPrices(ym: string): number[] {
  const D = daysInMonth(ym)
  const month = Number(ym.slice(5))
  const summer = month >= 4 && month <= 9
  const shape = (h: number) => (h < 6 ? 0.82 : h < 9 ? 1.0 : h < 17 ? (summer ? 0.66 : 0.92) : h < 22 ? 1.3 : 0.9)
  const r = prng(`hupx-${ym}`)
  const raw: number[] = []
  for (let d = 1; d <= D; d++) {
    const dow = weekdayOf(ym, d)
    const dayF = (dow === 0 ? 0.84 : dow === 6 ? 0.9 : 1) * (0.93 + r() * 0.14)
    for (let h = 0; h < 24; h++) raw.push(shape(h) * dayF)
  }
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length
  const base = hupxBase(ym) / 1000
  return raw.map(x => (x / mean) * base)
}

export interface TariffResult {
  tariffId: string
  months: { month: string, energyHuf: number }[]
  annualHuf: number
  kwh: number
  avgHufPerKwh: number
}

export function energyForMonth(def: TariffDef, ym: string, kwh: number[], prices?: number[]): number {
  const total = kwh.reduce((a, b) => a + b, 0)
  const fee = def.monthlyFeeHuf ?? 0
  if (def.kind === 'fix') return Math.round(total * (def.fixHufPerKwh ?? 0)) + fee
  if (def.kind === 'indexed') return Math.round(total * hupxBase(ym) / 1000) + Math.round(total * (def.marginHufPerKwh ?? 0)) + fee
  if (def.kind === 'tou') {
    const z = { nappali: 0, csucs: 0, volgy: 0 }
    kwh.forEach((v, i) => { z[zoneOfHour(i % 24)] += v })
    const p = def.zoneHufPerKwh ?? { nappali: 0, csucs: 0, volgy: 0 }
    return Math.round(z.nappali * p.nappali) + Math.round(z.csucs * p.csucs) + Math.round(z.volgy * p.volgy) + fee
  }
  const pr = prices ?? hourlyPrices(ym)
  const margin = def.marginHufPerKwh ?? 0
  return Math.round(kwh.reduce((s, v, i) => s + v * (pr[i]! + margin), 0)) + fee
}

export function simulate(tariffs: TariffDef[], intervals: IntervalData[]): TariffResult[] {
  const months = [...intervals].sort((a, b) => a.month.localeCompare(b.month))
  const prices = new Map(months.map(m => [m.month, hourlyPrices(m.month)]))
  return tariffs.map((t) => {
    const per = months.map(m => ({ month: m.month, energyHuf: energyForMonth(t, m.month, m.kwh, prices.get(m.month)) }))
    const annualHuf = per.reduce((s, m) => s + m.energyHuf, 0)
    const kwh = months.reduce((s, m) => s + m.kwh.reduce((a, b) => a + b, 0), 0)
    return { tariffId: t.id, months: per, annualHuf, kwh, avgHufPerKwh: kwh ? Math.round((annualHuf / kwh) * 100) / 100 : 0 }
  })
}

/** Fogyasztással súlyozott átlagár (Ft/kWh) a dinamikus árazásnál, a havi átlaghoz képest. */
export function weightedPrice(ym: string, kwh: number[]) {
  const pr = hourlyPrices(ym)
  const total = kwh.reduce((a, b) => a + b, 0)
  const weighted = total ? kwh.reduce((s, v, i) => s + v * pr[i]!, 0) / total : 0
  return { weighted, monthAvg: hupxBase(ym) / 1000 }
}

/** Egy hónap fogyasztását egész kWh-kká osztja szét súlyok szerint (legnagyobb maradék módszer), az összeg pontosan `total`. */
export function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map(w => (w / sum) * total)
  const out = raw.map(Math.floor)
  let rest = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (let k = 0; rest > 0; k++, rest--) out[order[k % order.length]![1]]!++
  return out
}

/**
 * Órás terhelési profil egy hónapra úgy, hogy a zónák összege pontosan a megadott (számlázott) zónaösszeg legyen.
 * Kereskedelmi telephely: nappal és este nagyobb, éjjel alapterhelés, vasárnap kevesebb.
 */
export function buildHourly(ym: string, zones: { nappali: number, csucs: number, volgy: number }, seed: string): number[] {
  const D = daysInMonth(ym)
  const r = prng(`iv-${seed}-${ym}`)
  const SHAPE = {
    nappali: [0.9, 1.0, 1.1, 1.15, 1.2, 1.2, 1.15, 1.1, 1.1, 1.05, 1.0], // 6..16
    csucs: [1.1, 1.15, 1.1, 1.0, 0.85], // 17..21
    volgy: [0.7, 0.65, 0.6, 0.6, 0.62, 0.7, 0.8, 0.75], // 22,23,0..5
  }
  const hoursOf = { nappali: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], csucs: [17, 18, 19, 20, 21], volgy: [22, 23, 0, 1, 2, 3, 4, 5] }
  const out = new Array<number>(D * 24).fill(0)
  for (const zone of ['nappali', 'csucs', 'volgy'] as const) {
    const idx: number[] = []; const w: number[] = []
    for (let d = 1; d <= D; d++) {
      const dow = weekdayOf(ym, d)
      const dayF = (dow === 0 ? 0.8 : dow === 6 ? 0.92 : 1) * (0.93 + r() * 0.14)
      hoursOf[zone].forEach((h, j) => { idx.push((d - 1) * 24 + h); w.push(SHAPE[zone][j]! * dayF * (0.95 + r() * 0.1)) })
    }
    distribute(zones[zone], w).forEach((v, k) => { out[idx[k]!] = v })
  }
  return out
}
