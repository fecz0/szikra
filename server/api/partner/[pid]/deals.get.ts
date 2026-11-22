export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'deals.view')
  return useBackend().listDeals(pid)
})
