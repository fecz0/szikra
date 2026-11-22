// CAP-05: nyitóoldal csempéi, a jogosultság szerint (nem látható adat nem is kerül ki).
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user, membership } = await requireCapability(event, pid, 'cases.view')
  const b = useBackend()
  const caps = (await import('../../../domain/permissions')).matrix[membership.role]
  const has = (c: string) => (caps as readonly string[]).includes(c)

  const [invoices, supply, cases, notifications] = await Promise.all([
    has('invoices.view') ? b.listInvoices(pid) : Promise.resolve(null),
    has('supply.view') ? b.listSupplyPoints(pid) : Promise.resolve(null),
    b.listCases(pid),
    b.listNotifications(pid),
  ])
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
    supply: supply && { count: supply.length, lastReadingDate: supply.map(s => s.lastReadingDate).sort().at(-1) ?? null },
    notifications: notifications.slice(0, 5),
  }
})
