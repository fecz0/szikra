import { REQUIRED_APPROVALS } from '../../../../../domain/approvals'

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const oid = getRouterParam(event, 'oid') ?? ''
  const { user } = await requireCapability(event, pid, 'outages.approve')
  const b = useBackend()
  const rec = await b.approveOutage(pid, oid, { userId: user.id, name: user.name })
  await b.addAudit({ userId: user.id, partnerId: pid, action: `leállás jóváhagyva (${rec.approvals.length}/${REQUIRED_APPROVALS}): ${oid}` })
  return rec
})
