import type { Role } from './types.ts'

/**
 * Jogosultsági mátrix (CAP-04): szerepkör -> képesség.
 * A BFF minden hívásnál ellenőrzi, a UI ugyanebből rejti el a gombokat.
 */
export type Capability =
  | 'invoices.view' | 'invoices.pay'
  | 'supply.view' | 'supply.reading'
  | 'cases.view' | 'cases.create'
  | 'quotes.create'
  | 'users.view'

export const matrix: Record<Role, readonly Capability[]> = {
  admin: ['invoices.view', 'invoices.pay', 'supply.view', 'supply.reading', 'cases.view', 'cases.create', 'quotes.create', 'users.view'],
  penzugy: ['invoices.view', 'invoices.pay', 'cases.view', 'cases.create'],
  muszaki: ['supply.view', 'supply.reading', 'cases.view', 'cases.create', 'quotes.create'],
  olvaso: ['invoices.view', 'supply.view', 'cases.view'],
}

export const roleLabel: Record<Role, string> = {
  admin: 'Adminisztrátor',
  penzugy: 'Pénzügyi',
  muszaki: 'Műszaki',
  olvaso: 'Olvasó',
}

export const can = (role: Role | undefined, cap: Capability) => !!role && matrix[role].includes(cap)

/** Mely ügytípust ki indíthat (az ügytípus `capability` mezője alapján). */
