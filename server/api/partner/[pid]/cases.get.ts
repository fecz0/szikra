export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'cases.view')
  return useBackend().listCases(pid)
})
