export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'cases.view')
  const rec = await useBackend().getCase(pid, getRouterParam(event, 'cid') ?? '')
  if (!rec) throw createError({ statusCode: 404, message: 'Az ügy nem található' })
  return rec
})
