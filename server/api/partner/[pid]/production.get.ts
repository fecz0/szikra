// Havi termelés és átvételi elszámolás (termelő partnereknek, pl. napelempark).
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'production.view')
  return useBackend().listProduction(pid)
})
