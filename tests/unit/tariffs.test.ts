import { describe, expect, it } from 'vitest'
import { buildChain } from '../../server/domain/demo-data'
import { NETWORK, TRANSMISSION_FEE_PER_KWH, VAT_PCT, electricityLines, gasLines, totals } from '../../server/domain/tariffs'

describe('rendszerhasználati díjak (E.ON, MEKH H2995/2025, 2026)', () => {
  it('a közzétett értékek stimmelnek', () => {
    expect(TRANSMISSION_FEE_PER_KWH).toBe(3.39)
    expect(NETWORK['KIF IV.']).toMatchObject({ baseFeePerYear: 1446, trafficFeePerKwh: 20.01 })
    expect(NETWORK['KIF III.']).toMatchObject({ baseFeePerYear: 72168, capacityFeePerKwYear: 13248, trafficFeePerKwh: 22.2 })
    expect(NETWORK['KÖF']).toMatchObject({ baseFeePerYear: 216504, capacityFeePerKwYear: 15924, trafficFeePerKwh: 8.39 })
  })
})

describe('számlatételek', () => {
  const z = { nappali: 50_000, csucs: 22_000, volgy: 24_000 }
  it('KIF III.: van lekötött teljesítménydíj, KIF IV.: nincs', () => {
    const iii = electricityLines({ zones: z, tariff: 'Ipari fix 2026', hupxHufPerMwh: 36_000, contractedKw: 280, category: 'KIF III.' })
    const iv = electricityLines({ zones: z, tariff: 'Ipari fix 2026', hupxHufPerMwh: 36_000, contractedKw: 280, category: 'KIF IV.' })
    expect(iii.some(l => l.code === 'RH-TELJ')).toBe(true)
    expect(iv.some(l => l.code === 'RH-TELJ')).toBe(false)
  })
  it('a tarifa határozza meg az energiasorokat', () => {
    const codes = (tariff: string) => electricityLines({ zones: z, tariff, hupxHufPerMwh: 36_000, contractedKw: 100, category: 'KIF IV.' }).filter(l => l.category === 'energia').map(l => l.code)
    expect(codes('Ipari fix 2026')).toEqual(['EN-FIX'])
    expect(codes('Piaci követő')).toEqual(['EN-HUPX', 'EN-MARZS'])
    expect(codes('Kereskedelmi csúcs-völgy')).toEqual(['EN-NAP', 'EN-CSUCS', 'EN-VOLGY'])
  })
  it('az ÁFA a nettó 27%-a, a bruttó a kettő összege', () => {
    const t = totals(gasLines({ m3: 5000, contractedKwhH: 70 }))
    expect(VAT_PCT).toBe(27)
    expect(t.vat).toBe(Math.round(t.net * 0.27))
    expect(t.gross).toBe(t.net + t.vat)
  })
})

describe('a lánc számlái belsőleg konzisztensek', () => {
  const chain = buildChain('T-LANC', 'Teszt lánc')
  it('a végösszeg a tételek bruttója, a tételösszeg egész forint', () => {
    for (const i of chain.invoices) {
      expect(i.lines?.length).toBeGreaterThan(3)
      expect(i.amountHuf).toBe(totals(i.lines!).gross)
      for (const l of i.lines!) expect(l.quantity * l.unitPrice).toBeCloseTo(l.amountHuf, 6)
    }
  })
  it('a zónák összege a fogyasztás, a mérőállás-különbség is ennyi', () => {
    for (const i of chain.invoices) {
      const u = i.usage!
      expect(u.currReading - u.prevReading).toBe(u.total)
      if (u.zones) expect(u.zones.nappali + u.zones.csucs + u.zones.volgy).toBe(u.total)
    }
  })
})
