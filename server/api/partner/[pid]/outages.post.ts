// Leállás javaslata. Nem lép életbe addig, amíg két KÜLÖNBÖZŐ jóváhagyó el nem fogadja (négy szem elve).
const iso = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user } = await requireCapability(event, pid, 'outages.propose')
  const b = await readBody<{ supplyPointId?: string, kind?: string, from?: string, to?: string, purpose?: string }>(event)
  const today = new Date().toISOString().slice(0, 10)
  const from = String(b.from ?? ''); const to = String(b.to ?? '')
  const kind = b.kind === 'rendkivuli' ? 'rendkivuli' : b.kind === 'tervezett' ? 'tervezett' : null
  if (!kind) throw createError({ statusCode: 400, message: 'Ismeretlen leállás-típus' })
  if (!iso.test(from) || !iso.test(to) || to < from) throw createError({ statusCode: 400, message: 'Érvénytelen időszak' })
  if (from < today) throw createError({ statusCode: 400, message: 'A leállás nem kezdődhet a múltban' })
  const purpose = String(b.purpose ?? '').trim().slice(0, 300)
  if (!purpose) throw createError({ statusCode: 400, message: 'Kötelező mező: Cél' })
  const backend = useBackend()
  const points = await backend.listSupplyPoints(pid)
  if (!points.some(p => p.id === b.supplyPointId && p.direction === 'termeles')) throw createError({ statusCode: 400, message: 'Ismeretlen termelőhely' })
  const rec = await backend.proposeOutage(pid, { supplyPointId: b.supplyPointId!, kind, from, to, purpose, by: { userId: user.id, name: user.name } })
  await backend.addAudit({ userId: user.id, partnerId: pid, action: `leállás javasolva: ${rec.id}` })
  return rec
})
