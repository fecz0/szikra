// Az ügylet visszaigazolása: a partner elfogadja a kereskedői visszaigazolásban szereplő feltételeket.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const did = getRouterParam(event, 'did') ?? ''
  const { user } = await requireCapability(event, pid, 'deals.confirm')
  const b = useBackend()
  await b.confirmDeal(pid, did, user.name)
  await b.addAudit({ userId: user.id, partnerId: pid, action: `ügylet visszaigazolva: ${did}` })
  return { dealId: did, status: 'visszaigazolva' }
})
