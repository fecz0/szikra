// A számla mellé a telephely neve és az energiafajta kerül (a szerver olvassa a fogyasztási helyeket,
// így a pénzügyi szerepkör is látja, melyik telephelyé a számla, a fogyasztási adatok láthatósága nélkül).
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'invoices.view')
  const b = useBackend()
  const [invoices, points] = await Promise.all([b.listInvoices(pid), b.listSupplyPoints(pid)])
  const byId = new Map(points.map(p => [p.id, p]))
  return invoices.map((i) => {
    const sp = i.supplyPointId ? byId.get(i.supplyPointId) : undefined
    // a számlalista nem kell a tételekhez; azokat a részletező végpont adja
    const { lines: _l, usage: _u, ...rest } = i
    return { ...rest, siteLabel: sp?.label, energy: sp?.type }
  })
})
