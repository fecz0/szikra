// A belépő oldal demó-felhasználói (csak NUXT_PUBLIC_DEMO_USERS=true esetén).
export default defineEventHandler(async (event) => {
  if (!useRuntimeConfig(event).public.demoUsers) return []
  const backend = useBackend()
  const users = await backend.listUsers()
  return Promise.all(users.map(async (u) => {
    const full = await backend.getUser(u.id)
    return { ...u, companies: full?.memberships.map(m => ({ name: m.partner.name, role: m.role })) ?? [] }
  }))
})
