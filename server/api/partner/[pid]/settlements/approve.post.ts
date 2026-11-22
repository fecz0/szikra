import { REQUIRED_APPROVALS } from '../../../../domain/approvals'

// Nagy összegű (>= 1 Mrd Ft) havi átvételi elszámolás jóváhagyása: két különböző jóváhagyó kell.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user } = await requireCapability(event, pid, 'settlements.approve')
  const { month } = await readBody<{ month?: string }>(event)
  if (!/^\d{4}-\d{2}$/.test(String(month ?? ''))) throw createError({ statusCode: 400, message: 'Érvénytelen hónap' })
  const b = useBackend()
  const n = await b.approveSettlements(pid, month!, { userId: user.id, name: user.name })
  await b.addAudit({ userId: user.id, partnerId: pid, action: `átvételi elszámolás jóváhagyva (jóváhagyás ${REQUIRED_APPROVALS} szükséges): ${month}` })
  return { month, approved: n }
})
