import { NETWORK_SOURCE, VAT_PCT } from '../../../../domain/tariffs'

// Számlakép: tételek, mérőadatok, a felhasználási hely és a hálózati kategória adatai.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { membership } = await requireCapability(event, pid, 'invoices.view')
  const b = useBackend()
  const invoice = await b.getInvoice(pid, getRouterParam(event, 'iid') ?? '')
  if (!invoice) throw createError({ statusCode: 404, message: 'A számla nem található' })
  const sp = invoice.supplyPointId ? (await b.listSupplyPoints(pid)).find(s => s.id === invoice.supplyPointId) : undefined
  const net = (invoice.lines ?? []).reduce((s, l) => s + l.amountHuf, 0)
  return {
    invoice,
    partner: { name: membership.partner.name, taxNumber: membership.partner.taxNumber, contractNo: membership.partner.contractNo, address: membership.partner.address },
    supplyPoint: sp && { label: sp.label, pod: sp.pod, address: sp.address, meterSerial: sp.meterSerial, type: sp.type, tariff: sp.tariff, contractedKw: sp.contractedKw, networkCategory: sp.networkCategory },
    totals: invoice.lines ? { net, vat: invoice.amountHuf - net, vatPct: VAT_PCT } : null,
    source: NETWORK_SOURCE,
  }
})
