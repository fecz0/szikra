// Mock SSO ("MVM Fiók" helyett): a demóban a felhasználó azonosítójával lépünk be.
export default defineEventHandler(async (event) => {
  const { userId } = await readBody<{ userId?: string }>(event)
  const found = userId ? await useBackend().getUser(userId) : null
  if (!found) throw createError({ statusCode: 401, message: 'Ismeretlen felhasználó' })
  const s = await useAuthSession(event)
  await s.update({ userId: found.user.id })
  await useBackend().addAudit({ userId: found.user.id, partnerId: '-', action: 'belépés' })
  return { ok: true }
})
