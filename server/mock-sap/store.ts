import type { SapCustomer } from './types'

// Folyamaton belüli állapot. A mock célja a gyors, izolált teszt, nem a tartósság.
export const customers = new Map<string, SapCustomer>()

// Nyilvános demón a seed végpont bárkinek elérhető: a memóriát korlátozzuk,
// a legrégebbi objektumokat eldobjuk (a Map beszúrási sorrendet őriz).
const MAX_CUSTOMERS = 500

export function saveCustomer(c: SapCustomer) {
  customers.set(c.id, c)
  while (customers.size > MAX_CUSTOMERS) {
    const oldest = customers.keys().next().value
    if (oldest === undefined) break
    customers.delete(oldest)
  }
}
