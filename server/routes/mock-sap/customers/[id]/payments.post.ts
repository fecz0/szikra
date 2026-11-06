import { customers } from '../../../../mock-sap/store'

export default defineEventHandler(async (event) => {
  requireMockSap(event)
  const customer = customers.get(getRouterParam(event, 'id') ?? '')
  if (!customer) throw createError({ statusCode: 404, message: 'Ismeretlen ügyfél' })

  const { billId } = await readBody<{ billId: string }>(event)
  const bill = customer.bills.find(b => b.id === billId)
  if (!bill) throw createError({ statusCode: 404, message: 'Ismeretlen számla' })
  if (bill.status === 'paid') throw createError({ statusCode: 409, message: 'A számla már ki van egyenlítve' })
  if (customer.paymentMethod.declines) {
    throw createError({ statusCode: 402, message: 'A kártyaterhelést a bank elutasította' })
  }
  bill.status = 'paid'
  return { billId, status: bill.status }
})
