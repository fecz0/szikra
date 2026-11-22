// Intervallum-mérőadat egy fogyasztási helyre (terhelési profil). A supplyPointId kötelező: a teljes adat nagy.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'supply.view')
  const sp = String(getQuery(event).supplyPointId ?? '')
  if (!sp) throw createError({ statusCode: 400, message: 'Hiányzó supplyPointId' })
  return useBackend().listIntervals(pid, sp)
})
