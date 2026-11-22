export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'outages.view')
  return useBackend().listOutages(pid)
})
