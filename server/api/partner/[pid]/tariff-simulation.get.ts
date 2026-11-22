import { SYSTEM_TARIFFS, kindLabel, simulate, weightedPrice } from '../../../domain/pricing'

/**
 * Díjcsomag-szimulátor: a fogyasztási hely 12 havi intervallumadatából minden díjcsomag energiadíját kiszámolja,
 * és a jelenlegi díjcsomag eredményét a ténylegesen kiszámlázott energiadíjjal veti össze (a motor próbája).
 */
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'tariffs.view')
  const spId = String(getQuery(event).supplyPointId ?? '')
  const b = useBackend()
  const sp = (await b.listSupplyPoints(pid)).find(s => s.id === spId && s.type === 'villany' && s.direction !== 'termeles')
  if (!sp) throw createError({ statusCode: 404, message: 'Ismeretlen fogyasztási hely' })
  const [intervals, custom] = await Promise.all([b.listIntervals(pid, spId), b.listTariffs(pid)])
  if (!intervals.length) return { supplyPoint: { id: sp.id, label: sp.label, tariff: sp.tariff }, available: false, results: [] }

  const tariffs = [...SYSTEM_TARIFFS, ...custom]
  const results = simulate(tariffs, intervals)
  const currentDef = tariffs.find(t => t.name === sp.tariff)
  const current = results.find(r => r.tariffId === currentDef?.id)

  // ténylegesen kiszámlázott energiadíj ugyanarra a 12 hónapra (a számlák energia-tételei)
  const labels = new Set(intervals.map(i => period(i.month)))
  const invoices = (await b.listInvoices(pid)).filter(i => i.supplyPointId === spId && labels.has(i.period))
  const billed = (await Promise.all(invoices.map(i => b.getInvoice(pid, i.id)))).reduce((sum, inv) => sum + (inv?.lines ?? []).filter(l => l.category === 'energia').reduce((a, l) => a + l.amountHuf, 0), 0)

  const wp = intervals.map(i => ({ month: i.month, ...weightedPrice(i.month, i.kwh) }))
  const kwhTotal = intervals.reduce((s, i) => s + i.kwh.reduce((a, c) => a + c, 0), 0)
  return {
    available: true,
    supplyPoint: { id: sp.id, label: sp.label, tariff: sp.tariff },
    kwh: kwhTotal,
    months: intervals.map(i => i.month),
    results: results.map((r) => {
      const t = tariffs.find(x => x.id === r.tariffId)!
      return { tariff: { id: t.id, name: t.name, kind: t.kind, kindLabel: kindLabel[t.kind], system: !!t.system, monthlyFeeHuf: t.monthlyFeeHuf ?? 0 }, annualHuf: r.annualHuf, avgHufPerKwh: r.avgHufPerKwh, months: r.months, isCurrent: r.tariffId === currentDef?.id, savingVsCurrentHuf: current ? current.annualHuf - r.annualHuf : null }
    }),
    reconciliation: current ? { currentAnnualHuf: current.annualHuf, billedEnergyHuf: billed, diffHuf: current.annualHuf - billed, invoices: invoices.length } : null,
    dynamicWeighting: { weightedHufPerKwh: Math.round((wp.reduce((s, m) => s + m.weighted, 0) / wp.length) * 100) / 100, monthAvgHufPerKwh: Math.round((wp.reduce((s, m) => s + m.monthAvg, 0) / wp.length) * 100) / 100 },
  }
})

const HU = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
function period(ym: string) { return `${ym.slice(0, 4)}. ${HU[Number(ym.slice(5)) - 1]}` }
