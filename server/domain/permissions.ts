import type { Role } from './types.ts'

/**
 * Jogosultsági mátrix (CAP-04): szerepkör -> képesség.
 * A BFF minden hívásnál ellenőrzi, a UI ugyanebből rejti el a gombokat.
 */
export type Capability =
  | 'invoices.view' | 'invoices.pay'
  | 'supply.view' | 'supply.reading'
  | 'production.view'
  | 'contracts.manage'
  | 'deals.view' | 'deals.confirm'
  | 'schedule.view' | 'schedule.submit'
  | 'credit.view'
  | 'cases.view' | 'cases.create'
  | 'quotes.create'
  | 'users.view'

export const matrix: Record<Role, readonly Capability[]> = {
  admin: ['invoices.view', 'invoices.pay', 'supply.view', 'supply.reading', 'production.view', 'contracts.manage', 'deals.view', 'deals.confirm', 'schedule.view', 'schedule.submit', 'credit.view', 'cases.view', 'cases.create', 'quotes.create', 'users.view'],
  penzugy: ['invoices.view', 'invoices.pay', 'production.view', 'deals.view', 'credit.view', 'cases.view', 'cases.create'],
  muszaki: ['supply.view', 'supply.reading', 'production.view', 'schedule.view', 'cases.view', 'cases.create', 'quotes.create'],
  olvaso: ['invoices.view', 'supply.view', 'production.view', 'deals.view', 'schedule.view', 'credit.view', 'cases.view'],
  kereskedo: ['invoices.view', 'deals.view', 'deals.confirm', 'schedule.view', 'schedule.submit', 'credit.view', 'cases.view', 'cases.create'],
}

export const roleLabel: Record<Role, string> = {
  admin: 'Adminisztrátor',
  penzugy: 'Pénzügyi',
  muszaki: 'Műszaki',
  olvaso: 'Olvasó',
  kereskedo: 'Kereskedő',
}

export const can = (role: Role | undefined, cap: Capability) => !!role && matrix[role].includes(cap)

/** Mely ügytípust ki indíthat (az ügytípus `capability` mezője alapján). */
