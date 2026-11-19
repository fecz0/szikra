export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'supply.view')
  return useBackend().listSupplyPoints(pid)
})
