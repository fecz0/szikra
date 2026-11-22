import { seedDataset } from '../../domain/scenarios'
import type { ScenarioName } from '../../domain/scenarios'
import { scenarios } from '../../domain/scenarios'
import type { Role } from '../../domain/types'

// Teszt-seed: egy új partner + egyedi felhasználó, adott forgatókönyvvel és szerepkörrel.
// Csak NUXT_TEST_SEED=true és snapshot háttér mellett él.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const b = useBackend()
  if (!cfg.testSeed || !b.load) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const { scenario, role = 'admin', extraRoles = [] } = await readBody<{ scenario?: string, role?: Role, extraRoles?: Role[] }>(event)
  if (!scenario || !(scenario in scenarios)) throw createError({ statusCode: 400, message: 'Ismeretlen forgatókönyv' })
  const uid = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
  const { dataset, userId, partnerId } = seedDataset(scenario as ScenarioName, role, uid)
  // további felhasználók ugyanannál a cégnél (pl. a négy szem elvének második jóváhagyója)
  const extra: Record<string, string> = {}
  for (const r of extraRoles) {
    const id = `U-${uid}-${r}`
    dataset.users.push({ id, name: `Teszt ${r}`, email: `${uid}-${r}@teszt.szikra.test`, note: 'teszt' })
    dataset.memberships.push({ userId: id, partnerId, role: r })
    extra[r] = id
  }
  b.load(dataset)
  return { userId, partnerId, extra }
})
