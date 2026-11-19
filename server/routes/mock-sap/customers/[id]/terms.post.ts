import { customers } from '../../../../mock-sap/store'

/** Az ÁSZF elfogadása: a felhasználó elfogadott verziója az aktuálisra frissül. */
export default defineEventHandler((event) => {
  requireMockSap(event)
  const customer = customers.get(getRouterParam(event, 'id') ?? '')
  if (!customer) throw createError({ statusCode: 404, message: 'Ismeretlen ügyfél' })

  customer.terms.acceptedVersion = customer.terms.current.id
  return { acceptedVersion: customer.terms.acceptedVersion }
})
