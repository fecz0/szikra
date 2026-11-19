import type { Capability } from './permissions.ts'
import type { CaseTypeId } from './types.ts'

export interface CaseField {
  key: string
  label: string
  kind: 'text' | 'number' | 'invoice' | 'supply' | 'textarea'
  required?: boolean
}

export interface CaseTypeDef {
  id: CaseTypeId
  ucId: string
  label: string
  hint: string
  capability: Capability
  fields: CaseField[]
}

/**
 * CAP-16: közös ügyindítási keretrendszer. Az egyedi ügytípus csak konfiguráció:
 * mezők + szükséges jogosultság. Új ügytípus = új bejegyzés ide (és az ERPNext Issue Type-ba).
 */
export const caseTypes: Record<CaseTypeId, CaseTypeDef> = {
  szamlareklamacio: {
    id: 'szamlareklamacio', ucId: 'UC-03', label: 'Számlareklamáció',
    hint: 'Vitatja egy számla összegét vagy tartalmát.',
    capability: 'invoices.view',
    fields: [
      { key: 'invoice', label: 'Számla', kind: 'invoice', required: true },
      { key: 'reason', label: 'A reklamáció oka', kind: 'textarea', required: true },
    ],
  },
  tartozasigazolas: {
    id: 'tartozasigazolas', ucId: 'UC-07', label: 'Tartozásigazolás',
    hint: 'Igazolás az aktuális tartozásról vagy tartozásmentességről.',
    capability: 'invoices.view',
    fields: [
      { key: 'purpose', label: 'Az igazolás célja', kind: 'text', required: true },
    ],
  },
  meroallas: {
    id: 'meroallas', ucId: 'UC-10/11', label: 'Mérőállás közlése',
    hint: 'Diktálási időszakban vagy köztes leolvasáskor.',
    capability: 'supply.reading',
    fields: [
      { key: 'supply', label: 'Fogyasztási hely', kind: 'supply', required: true },
      { key: 'reading', label: 'Mérőállás', kind: 'number', required: true },
    ],
  },
  ajanlatkeres: {
    id: 'ajanlatkeres', ucId: 'CAP-07', label: 'Ajánlatkérés',
    hint: 'Új fogyasztási hely vagy új szerződés ajánlata.',
    capability: 'quotes.create',
    fields: [
      { key: 'energy', label: 'Energiafajta (villany/gáz)', kind: 'text', required: true },
      { key: 'volume', label: 'Várható éves fogyasztás', kind: 'number' },
      { key: 'note', label: 'Megjegyzés', kind: 'textarea' },
    ],
  },
}

export const statusLabel: Record<string, string> = {
  'uj': 'Új',
  'folyamatban': 'Folyamatban',
  'visszajelzesre-var': 'Visszajelzésre vár',
  'lezart': 'Lezárva',
}
