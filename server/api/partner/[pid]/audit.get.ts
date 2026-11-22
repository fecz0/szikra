// Auditnapló (megfelelőség): ki mit csinált a cégnél. Csak az audit.view képességgel.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  await requireCapability(event, pid, 'audit.view')
  const b = useBackend()
  const [entries, users] = await Promise.all([b.listAudit(pid), b.listUsers()])
  const names = new Map(users.map(u => [u.id, u.name]))
  return entries.slice(0, 200).map(e => ({ ...e, userName: names.get(e.userId) ?? e.userId }))
})
