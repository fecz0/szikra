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
  | 'outages.view' | 'outages.propose' | 'outages.approve'
  | 'settlements.approve'
  | 'audit.view'
  | 'tariffs.view' | 'tariffs.manage'
  | 'cases.view' | 'cases.create'
  | 'quotes.create'
  | 'users.view'

export const matrix: Record<Role, readonly Capability[]> = {
  admin: ['invoices.view', 'invoices.pay', 'supply.view', 'supply.reading', 'production.view', 'contracts.manage', 'deals.view', 'deals.confirm', 'schedule.view', 'schedule.submit', 'credit.view', 'outages.view', 'outages.propose', 'outages.approve', 'settlements.approve', 'audit.view', 'tariffs.view', 'tariffs.manage', 'cases.view', 'cases.create', 'quotes.create', 'users.view'],
  penzugy: ['invoices.view', 'invoices.pay', 'production.view', 'deals.view', 'credit.view', 'settlements.approve', 'tariffs.view', 'cases.view', 'cases.create'],
  muszaki: ['supply.view', 'supply.reading', 'production.view', 'schedule.view', 'outages.view', 'outages.propose', 'tariffs.view', 'cases.view', 'cases.create', 'quotes.create'],
  olvaso: ['invoices.view', 'supply.view', 'production.view', 'deals.view', 'schedule.view', 'credit.view', 'outages.view', 'tariffs.view', 'cases.view'],
  megfelelo: ['invoices.view', 'supply.view', 'production.view', 'deals.view', 'schedule.view', 'credit.view', 'outages.view', 'outages.approve', 'settlements.approve', 'audit.view', 'tariffs.view', 'cases.view'],
  kereskedo: ['invoices.view', 'deals.view', 'deals.confirm', 'schedule.view', 'schedule.submit', 'credit.view', 'cases.view', 'cases.create'],
}

export const roleLabel: Record<Role, string> = {
  admin: 'Adminisztrátor',
  penzugy: 'Pénzügyi',
  muszaki: 'Műszaki',
  olvaso: 'Olvasó',
  kereskedo: 'Kereskedő',
  megfelelo: 'Megfelelőségi felelős',
}

export const can = (role: Role | undefined, cap: Capability) => !!role && matrix[role].includes(cap)

/** Mely ügytípust ki indíthat (az ügytípus `capability` mezője alapján). */
