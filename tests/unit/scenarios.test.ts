import { describe, expect, it } from 'vitest'
import { fixedDemoDataset, scenarios } from '../../server/domain/scenarios'
import snapshot from '../../server/data/snapshot.json'

describe('seed forgatókönyvek', () => {
  for (const [name, make] of Object.entries(scenarios)) {
    it(`${name}: belsőleg konzisztens`, () => {
      const f = make('TEST')
      const spIds = new Set(f.supplyPoints.map(s => s.id))
      expect(f.invoices.length).toBeGreaterThan(0)
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
