import { PaymentDeclined } from '../../../../../utils/backend'

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const iid = getRouterParam(event, 'iid') ?? ''
  const { user } = await requireCapability(event, pid, 'invoices.pay')
  const b = useBackend()
  try {
    await b.payInvoice(pid, iid, user.name)
  }
  catch (e) {
    if (e instanceof PaymentDeclined) {
      await b.addAudit({ userId: user.id, partnerId: pid, action: `fizetés elutasítva: ${iid}` })
      throw createError({ statusCode: 402, message: 'A bank elutasította a kártyaterhelést' })
    }
    throw e
  }
  await b.addAudit({ userId: user.id, partnerId: pid, action: `számla kiegyenlítve: ${iid}` })
  return { invoiceId: iid, status: 'paid' }
})
