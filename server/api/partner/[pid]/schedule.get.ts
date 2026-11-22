export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'schedule.view')
  return useBackend().listSchedule(pid)
})
