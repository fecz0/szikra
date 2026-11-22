// CAP-05: nyitóoldal csempéi, a jogosultság szerint (nem látható adat nem is kerül ki).
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user, membership } = await requireCapability(event, pid, 'cases.view')
  const b = useBackend()
  const caps = (await import('../../../domain/permissions')).matrix[membership.role]
  const has = (c: string) => (caps as readonly string[]).includes(c)

  const producer = membership.partner.kind === 'termelo'
  const trader = membership.partner.kind === 'kereskedo'
  const [invoices, supply, production, cases, notifications] = await Promise.all([
    has('invoices.view') && !producer ? b.listInvoices(pid) : Promise.resolve(null),
    has('supply.view') ? b.listSupplyPoints(pid) : Promise.resolve(null),
    has('production.view') && producer ? b.listProduction(pid) : Promise.resolve(null),
    b.listCases(pid),
    b.listNotifications(pid),
  ])
  const deals = trader && has('deals.view') ? await b.listDeals(pid) : null
  const schedule = trader && has('schedule.view') ? await b.listSchedule(pid) : null
  const { creditPosition } = await import('../../../utils/credit')
  const credit = trader && has('credit.view') ? creditPosition(membership.partner, deals ?? await b.listDeals(pid), await b.listInvoices(pid)) : null
  await b.addAudit({ userId: user.id, partnerId: pid, action: 'nyitóoldal megtekintése' })
  return {
    partner: membership.partner,
    role: membership.role,
    openCases: cases.filter(c => c.status !== 'lezart').length,
    invoices: invoices && {
      open: invoices.filter(i => i.status === 'open').length,
      overdue: invoices.filter(i => i.status === 'overdue').length,
      outstandingHuf: invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amountHuf, 0),
    },
    production: production && (() => {
      const last = production.map(p => p.month).sort().at(-1)
      const m = production.filter(p => p.month === last)
      return { month: last ?? null, mwh: Math.round(m.reduce((s, p) => s + p.mwh, 0) * 10) / 10, settlementHuf: m.reduce((s, p) => s + p.settlementHuf, 0), openSettlements: production.filter(p => p.status !== 'kifizetve').length }
    })(),
    trading: trader && {
      pendingDeals: deals?.filter(d => d.status === 'visszaigazolasra-var').length ?? null,
      disputedDeals: deals?.filter(d => d.status === 'vitatott').length ?? null,
      credit: credit && { usedPct: credit.usedPct, limitHuf: credit.limitHuf, usedHuf: credit.usedHuf, guaranteeDaysLeft: credit.guaranteeDaysLeft },
      tomorrowSubmitted: schedule ? (() => { const t = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10); return schedule.some(x => x.date === t && x.commodity === 'villany') })() : null,
    },
    supply: supply && { count: supply.length, lastReadingDate: supply.map(s => s.lastReadingDate).sort().at(-1) ?? null },
    notifications: notifications.slice(0, 5),
  }
})
