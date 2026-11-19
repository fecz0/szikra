import type { H3Event } from 'h3'
import type { Capability } from '../domain/permissions'
import { can } from '../domain/permissions'
import type { Membership, Partner, PortalUser } from '../domain/types'

interface SessionData { userId?: string }

// Ha nincs NUXT_SESSION_PASSWORD, élesben folyamatonként új véletlen titkot használunk
// (újraindításkor a munkamenetek érvénytelenek), fejlesztéskor fix, ismert titkot.
const FALLBACK_PASSWORD = process.env.NODE_ENV === 'development'
  ? 'szikra-demo-munkamenet-jelszo-csak-fejleszteshez'
  : `${crypto.randomUUID()}${crypto.randomUUID()}`

export function useAuthSession(event: H3Event) {
  const password = useRuntimeConfig(event).sessionPassword || FALLBACK_PASSWORD
  return useSession<SessionData>(event, { name: 'szikra', password, maxAge: 60 * 60 * 8 })
}

export async function currentUser(event: H3Event): Promise<PortalUser> {
  const s = await useAuthSession(event)
  const u = s.data.userId ? await useBackend().getUser(s.data.userId) : null
  if (!u) throw createError({ statusCode: 401, message: 'Be kell jelentkezni' })
  return u.user
}

/**
 * A BFF jogosultság-kapuja: a kérés felhasználójának van-e a cégnél olyan szerepköre,
 * ami a képességet megadja. A böngésző által küldött cégazonosítóban sosem bízunk.
 */
export async function requireCapability(event: H3Event, partnerId: string, cap: Capability): Promise<{ user: PortalUser, membership: Membership & { partner: Partner } }> {
  const s = await useAuthSession(event)
  const u = s.data.userId ? await useBackend().getUser(s.data.userId) : null
  if (!u) throw createError({ statusCode: 401, message: 'Be kell jelentkezni' })
  const membership = u.memberships.find(m => m.partnerId === partnerId)
  if (!membership) throw createError({ statusCode: 403, message: 'Ehhez a céghez nincs hozzáférése' })
  if (!can(membership.role, cap)) throw createError({ statusCode: 403, message: 'Ehhez a művelethez nincs jogosultsága' })
  return { user: u.user, membership }
}
