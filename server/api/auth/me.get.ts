import { matrix } from '../../domain/permissions'

export default defineEventHandler(async (event) => {
  const s = await useAuthSession(event)
  const u = s.data.userId ? await useBackend().getUser(s.data.userId) : null
  if (!u) throw createError({ statusCode: 401, message: 'Be kell jelentkezni' })
  return {
    user: u.user,
    companies: u.memberships.map(m => ({ id: m.partnerId, name: m.partner.name, segment: m.partner.segment, role: m.role, capabilities: matrix[m.role] })),
  }
})
