import { seedDataset } from '../../domain/scenarios'
import type { ScenarioName } from '../../domain/scenarios'
import { scenarios } from '../../domain/scenarios'

// Teszt-seed: egy új partner + egyedi felhasználó, adott forgatókönyvvel és szerepkörrel.
// Csak NUXT_TEST_SEED=true és snapshot háttér mellett él.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const b = useBackend()
  if (!cfg.testSeed || !b.load) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const { scenario, role = 'admin' } = await readBody<{ scenario?: string, role?: 'admin' | 'penzugy' | 'muszaki' | 'olvaso' }>(event)
  if (!scenario || !(scenario in scenarios)) throw createError({ statusCode: 400, message: 'Ismeretlen forgatókönyv' })
  const uid = Math.random().toString(36).slice(2, 10).toUpperCase()
  const { dataset, userId, partnerId } = seedDataset(scenario as ScenarioName, role, uid)
  b.load(dataset)
  return { userId, partnerId }
})
