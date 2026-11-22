import { SYSTEM_TARIFFS, kindLabel } from '../../../domain/pricing'

// Díjcsomag-katalógus: rendszer-díjcsomagok + a partner egyedi díjcsomagjai.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'tariffs.view')
  const custom = await useBackend().listTariffs(pid)
  return [...SYSTEM_TARIFFS, ...custom].map(t => ({ ...t, kindLabel: kindLabel[t.kind] }))
})
