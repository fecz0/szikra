// A szimulátor fogyasztási helyei: a tariffs.view joghoz kötött (a pénzügyi szerepkör a fogyasztási helyeket egyébként nem látja),
// és csak a díjcsomag szempontjából szükséges adatot adja ki (név, jelenlegi díjcsomag, van-e intervallumadat).
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'tariffs.view')
  const b = useBackend()
  const points = (await b.listSupplyPoints(pid)).filter(p => p.type === 'villany' && p.direction !== 'termeles')
  return Promise.all(points.map(async p => ({ id: p.id, label: p.label ?? p.pod, tariff: p.tariff ?? null, hasIntervals: (await b.listIntervals(pid, p.id)).length > 0 })))
})
