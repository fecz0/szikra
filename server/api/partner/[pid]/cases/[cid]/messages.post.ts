export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const cid = getRouterParam(event, 'cid') ?? ''
  const { user } = await requireCapability(event, pid, 'cases.create')
  const { text } = await readBody<{ text?: string }>(event)
  const t = String(text ?? '').trim().slice(0, 2000)
  if (!t) throw createError({ statusCode: 400, message: 'Üres üzenet' })
  await useBackend().addMessage(pid, cid, { by: user.name, text: t })
  return { ok: true }
})
