import { randomUUID } from 'node:crypto'
import { scenarios } from '../../mock-sap/scenarios'
import { saveCustomer } from '../../mock-sap/store'

export default defineEventHandler(async (event) => {
  requireMockSap(event)
  const body = await readBody<{ scenario?: string }>(event)
  const make = body?.scenario ? scenarios[body.scenario] : undefined
  if (!make) {
    throw createError({
      statusCode: 400,
      message: `Ismeretlen forgatókönyv. Elérhető: ${Object.keys(scenarios).join(', ')}`,
    })
  }
  // Egyedi azonosító: a párhuzamos tesztek nem zavarják egymást.
  const id = `T${randomUUID().slice(0, 8).toUpperCase()}`
  const customer = make(id)
  saveCustomer(customer)
  return { customerId: id, scenario: body!.scenario }
})
