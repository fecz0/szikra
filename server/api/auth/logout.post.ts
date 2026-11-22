export default defineEventHandler(async (event) => {
  const s = await useAuthSession(event)
  await s.clear()
  return { ok: true }
})
