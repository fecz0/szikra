import type { Backend } from '../domain/backend-types'
import { MemoryBackend } from './backends/memory'
import { ErpNextBackend } from './backends/erpnext'

export type { Backend, UserWithMemberships } from '../domain/backend-types'
export { PaymentDeclined } from '../domain/backend-types'

let instance: Backend | undefined

export function useBackend(): Backend {
  if (instance) return instance
  const cfg = useRuntimeConfig()
  instance = cfg.backend === 'erpnext' ? new ErpNextBackend(cfg) : new MemoryBackend()
  return instance
}
