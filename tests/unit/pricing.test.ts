import { describe, expect, it } from 'vitest'
import { buildChain, MONTHS } from '../../server/domain/demo-data'
import { SYSTEM_TARIFFS, buildHourly, distribute, energyForMonth, hourlyPrices, simulate, weightedPrice, zoneOfHour } from '../../server/domain/pricing'
import { hupxBase } from '../../server/domain/tariffs'

const chain = buildChain('T-PRICING', 'Teszt lánc')
const defOf = (name?: string) => SYSTEM_TARIFFS.find(t => t.name === name)!

describe('tarifa-motor: a kiszámlázott energiadíjat adja vissza', () => {
  it('minden telephely-hónapban pontosan megegyezik a számlázott energiadíjjal (fix, tőzsdei követő, csúcs-völgy)', () => {
    let checked = 0
    for (const iv of chain.intervals!) {
      const inv = chain.invoices.find(i => i.supplyPointId === iv.supplyPointId && i.usage?.periodFrom.slice(0, 7) === iv.month)!
      const billed = inv.lines!.filter(l => l.category === 'energia').reduce((s, l) => s + l.amountHuf, 0)
      const tariff = chain.supplyPoints.find(s => s.id === iv.supplyPointId)!.tariff
      expect(energyForMonth(defOf(tariff), iv.month, iv.kwh), `${iv.supplyPointId} ${iv.month}`).toBe(billed)
      checked++
    }
    expect(checked).toBe(chain.intervals!.length)
    expect(checked).toBeGreaterThanOrEqual(MONTHS.length * 3)
  })
})

describe('intervallumadat', () => {
  it('a zónák összege pontosan a számlázott zónaösszeg, az összeg a számlázott fogyasztás', () => {
    for (const iv of chain.intervals!) {
      const inv = chain.invoices.find(i => i.supplyPointId === iv.supplyPointId && i.usage?.periodFrom.slice(0, 7) === iv.month)!
      const z = { nappali: 0, csucs: 0, volgy: 0 }
      iv.kwh.forEach((v, k) => { z[zoneOfHour(k % 24)] += v })
      expect(z).toEqual(inv.usage!.zones)
      expect(iv.kwh.reduce((a, b) => a + b, 0)).toBe(inv.usage!.total)
      expect(iv.kwh.every(v => Number.isInteger(v) && v >= 0)).toBe(true)
    }
  })
  it('a hossz nap × 24, éjjel kisebb a terhelés, mint nappal', () => {
    const iv = chain.intervals![0]!
    expect(iv.kwh.length % 24).toBe(0)
    const avg = (hs: number[]) => hs.reduce((s, h) => s + iv.kwh.filter((_, k) => k % 24 === h).reduce((a, b) => a + b, 0), 0) / hs.length
    expect(avg([1, 2, 3, 4])).toBeLessThan(avg([10, 11, 12, 13]))
  })
  it('az elosztás pontos és determinista', () => {
    const d = distribute(1003, [1, 2, 3, 4, 5.5])
    expect(d.reduce((a, b) => a + b, 0)).toBe(1003)
    expect(buildHourly('2026-03', { nappali: 5000, csucs: 2000, volgy: 1500 }, 'x')).toEqual(buildHourly('2026-03', { nappali: 5000, csucs: 2000, volgy: 1500 }, 'x'))
  })
})

describe('óránkénti tőzsdei ár', () => {
  it('a havi átlag pontosan a HUPX-átlag', () => {
    for (const ym of MONTHS) {
      const p = hourlyPrices(ym)
      expect(p.reduce((a, b) => a + b, 0) / p.length).toBeCloseTo(hupxBase(ym) / 1000, 6)
    }
  })
  it('nyáron délben olcsóbb, este drágább; a súlyozott ár magasabb az átlagnál az esti csúcsos telephelyen', () => {
    const p = hourlyPrices('2026-06')
    expect(p[12]!).toBeLessThan(p[19]!)
    let higher = 0
    for (const iv of chain.intervals!.filter(i => i.supplyPointId.endsWith('E1'))) {
      const w = weightedPrice(iv.month, iv.kwh)
      if (w.weighted > w.monthAvg) higher++
    }
    expect(higher).toBeGreaterThanOrEqual(8)
  })
})

describe('szimuláció', () => {
  const iv = chain.intervals!.filter(i => i.supplyPointId.endsWith('E1'))
  it('a magasabb fix ár drágább; a havi díj hozzáadódik', () => {
    const [cheap, dear] = simulate([{ id: 'a', name: 'a', kind: 'fix', fixHufPerKwh: 30 }, { id: 'b', name: 'b', kind: 'fix', fixHufPerKwh: 40, monthlyFeeHuf: 1000 }], iv)
    expect(dear!.annualHuf).toBeGreaterThan(cheap!.annualHuf)
    expect(dear!.annualHuf - Math.round(cheap!.kwh * 40)).toBe(12_000)
  })
  it('mind az öt rendszer-díjcsomag 12 hónapot számol, az átlagár a 30–50 Ft/kWh sávban van', () => {
    for (const r of simulate(SYSTEM_TARIFFS, iv)) {
      expect(r.months.length).toBe(12)
      expect(r.avgHufPerKwh).toBeGreaterThan(30)
      expect(r.avgHufPerKwh).toBeLessThan(50)
    }
  })
})
