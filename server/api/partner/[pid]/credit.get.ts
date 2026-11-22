import { creditPosition } from '../../../utils/credit'

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { membership } = await requireCapability(event, pid, 'credit.view')
  const b = useBackend()
  const [deals, invoices] = await Promise.all([b.listDeals(pid), b.listInvoices(pid)])
  return creditPosition(membership.partner, deals, invoices)
})
