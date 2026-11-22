import { describe, expect, it } from 'vitest'
import { caseTypes } from '../../server/domain/case-types'
import { can } from '../../server/domain/permissions'

describe('jogosultsági mátrix', () => {
  it('az olvasó semmit nem indíthat', () => {
    for (const t of Object.values(caseTypes)) expect(can('olvaso', 'cases.create') && can('olvaso', t.capability)).toBe(false)
  })
  it('a műszaki nem lát számlát, a pénzügyi nem közölhet mérőállást', () => {
    expect(can('muszaki', 'invoices.view')).toBe(false)
    expect(can('penzugy', 'supply.reading')).toBe(false)
  })
  it('az admin mindent', () => {
    expect(can('admin', 'invoices.pay') && can('admin', 'supply.reading') && can('admin', 'quotes.create')).toBe(true)
  })
})
