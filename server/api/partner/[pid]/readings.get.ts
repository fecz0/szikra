// Mérőállás-idősor (fogyasztási grafikon): a fogyasztási helyek láthatóságához kötött.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'supply.view')
  return useBackend().listReadings(pid)
})
