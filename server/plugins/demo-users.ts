import { demoUsers } from '../mock-sap/demo-users'
import { scenarios } from '../mock-sap/scenarios'
import { saveCustomer } from '../mock-sap/store'

const RESET_MS = 30 * 60 * 1000

export default defineNitroPlugin(() => {
  const cfg = useRuntimeConfig()
  if (!cfg.mockSap || !cfg.public.demoUsers) return

  // Indításkor és félóránként visszaállítjuk őket: a fizetések nem "ragadnak" be a következő nézőnek.
  const seedAll = () => {
    for (const u of demoUsers) saveCustomer(scenarios[u.scenario]!(u.id), { pin: true })
  }
  seedAll()
  setInterval(seedAll, RESET_MS).unref()
})
