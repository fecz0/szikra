import { customers } from '../../../mock-sap/store'

/** Mérőóra ID -> ügyfél: a meglévő mock SAP objektumokból oldja fel. */
export default defineEventHandler((event) => {
  requireMockSap(event)
  const id = getRouterParam(event, 'id') ?? ''
  for (const customer of customers.values()) {
    if (customer.meters.some(m => m.id === id)) return { customerId: customer.id }
  }
  throw createError({ statusCode: 404, message: 'Ismeretlen mérőóra' })
})
