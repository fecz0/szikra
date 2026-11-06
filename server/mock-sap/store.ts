import type { SapCustomer } from './types'

// Folyamaton belüli állapot. A mock célja a gyors, izolált teszt, nem a tartósság.
export const customers = new Map<string, SapCustomer>()

// Nyilvános demón a seed végpont bárkinek elérhető: a memóriát korlátozzuk,
// a legrégebbi objektumokat eldobjuk (a Map beszúrási sorrendet őriz).
// A rögzített demó ügyfelek (pinned) sosem esnek ki.
const MAX_CUSTOMERS = 500
const pinned = new Set<string>()

export function saveCustomer(c: SapCustomer, opts: { pin?: boolean } = {}) {
  if (opts.pin) pinned.add(c.id)
  customers.set(c.id, c)
  for (const id of customers.keys()) {
    if (customers.size <= MAX_CUSTOMERS) break
    if (!pinned.has(id)) customers.delete(id)
  }
}
