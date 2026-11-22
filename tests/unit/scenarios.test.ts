import { describe, expect, it } from 'vitest'
import { fixedDemoDataset, scenarios } from '../../server/domain/scenarios'
import snapshot from '../../server/data/snapshot.json'

describe('seed forgatókönyvek', () => {
  for (const [name, make] of Object.entries(scenarios)) {
    it(`${name}: belsőleg konzisztens`, () => {
      const f = make('TEST')
      const spIds = new Set(f.supplyPoints.map(s => s.id))
      // a termelő partner (napelempark) nem kap számlát, hanem termelési elszámolást
      expect(f.invoices.length + f.production.length).toBeGreaterThan(0)
      for (const i of f.invoices) {
        expect(i.partnerId).toBe(f.partner.id)
        if (i.supplyPointId) expect(spIds.has(i.supplyPointId)).toBe(true)
      }
      expect(new Set(f.invoices.map(i => i.id)).size).toBe(f.invoices.length)
    })
  }
})

describe('fix demó-adatkészlet és snapshot', () => {
  const ds = fixedDemoDataset()
  it('minden tagság létező felhasználóra és partnerre mutat', () => {
    const users = new Set(ds.users.map(u => u.id))
    const partners = new Set(ds.partners.map(p => p.id))
    for (const m of ds.memberships) {
      expect(users.has(m.userId)).toBe(true)
      expect(partners.has(m.partnerId)).toBe(true)
    }
  })
  it('a snapshot ugyanazokat a partnereket és felhasználókat tartalmazza', () => {
    expect(snapshot.partners.map(p => p.id).sort()).toEqual(ds.partners.map(p => p.id).sort())
    expect(snapshot.users.map(u => u.id).sort()).toEqual(ds.users.map(u => u.id).sort())
  })
})

import { htmlToText } from '../../server/utils/erp/mappers'

describe('htmlToText', () => {
  it('az ERPNext HTML-jét sima szöveggé alakítja', () => {
    expect(htmlToText('<div class="ql-editor"><p>Szia&nbsp;világ &amp; mások</p></div>')).toBe('Szia világ & mások')
  })
  it('egymásba ágyazott címkéből sem állhat össze új címke', () => {
    expect(htmlToText('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toContain('<')
  })
})

import { MONTHS, buildChain, buildSolarPark } from '../../server/domain/demo-data'

describe('demó-adatgenerátor', () => {
  const chain = buildChain('T-LANC', 'Teszt lánc')
  const solar = buildSolarPark('T-NAP', 'Teszt park')

  it('a lánc 12 hónapnyi számlát és mérőállást ad telephelyenként (+ nulladik állás)', () => {
    expect(chain.supplyPoints.length).toBe(12)
    expect(chain.invoices.length).toBe(12 * chain.supplyPoints.length)
    for (const sp of chain.supplyPoints) expect(chain.readings.filter(r => r.supplyPointId === sp.id).length).toBe(MONTHS.length + 1)
  })
  it('a mérőállások monoton nőnek, a számlák összege pozitív és valós nagyságrendű', () => {
    for (const sp of chain.supplyPoints) {
      const v = chain.readings.filter(r => r.supplyPointId === sp.id).map(r => r.value)
      expect(v).toEqual([...v].sort((a, b) => a - b))
    }
    const elec = chain.invoices.filter(i => i.id.includes('-INV-E1-'))
    for (const i of elec) { expect(i.amountHuf).toBeGreaterThan(3_000_000); expect(i.amountHuf).toBeLessThan(10_000_000) }
  })
  it('pontosan egy lejárt és legalább 10 nyitott számla van, a többi kiegyenlített', () => {
    expect(chain.invoices.filter(i => i.status === 'overdue').length).toBe(1)
    expect(chain.invoices.filter(i => i.status === 'open').length).toBeGreaterThanOrEqual(10)
  })
  it('a napelempark éves hozama a 20 MW-hoz illő, és a képlet stimmel', () => {
    const total = solar.production.reduce((s, p) => s + p.mwh, 0)
    expect(total).toBeGreaterThan(22_000); expect(total).toBeLessThan(28_000)
    for (const p of solar.production) expect(Math.abs(p.settlementHuf - (Math.round(p.mwh * p.priceHufPerMwh) + p.premiumHuf - p.imbalanceHuf))).toBeLessThanOrEqual(1)
    expect(solar.partner.kind).toBe('termelo')
  })
  it('determinista: ugyanaz az azonosító ugyanazt az adatot adja', () => {
    expect(buildSolarPark('T-NAP', 'Teszt park')).toEqual(solar)
  })
})
