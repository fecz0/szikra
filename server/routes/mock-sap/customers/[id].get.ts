import { customers } from '../../../mock-sap/store'

export default defineEventHandler((event) => {
  requireMockSap(event)
  const customer = customers.get(getRouterParam(event, 'id') ?? '')
  if (!customer) throw createError({ statusCode: 404, message: 'Ismeretlen ügyfél' })
  return customer
})
