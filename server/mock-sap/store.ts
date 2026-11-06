import type { SapCustomer } from './types'

// Folyamaton belüli állapot. A mock célja a gyors, izolált teszt, nem a tartósság.
export const customers = new Map<string, SapCustomer>()
