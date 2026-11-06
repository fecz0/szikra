import { describe, expect, it } from 'vitest'
import { scenarios } from '../../server/mock-sap/scenarios'

describe('SAP seed forgatókönyvek', () => {
  for (const [name, make] of Object.entries(scenarios)) {
    it(`${name}: belsőleg konzisztens`, () => {
      const c = make('TEST')
      const meterIds = new Set(c.meters.map(m => m.id))
      expect(c.bills.length).toBeGreaterThan(0)
      for (const b of c.bills) expect(meterIds.has(b.meterId)).toBe(true)
      expect(new Set(c.bills.map(b => b.id)).size).toBe(c.bills.length)
    })
  }
})
