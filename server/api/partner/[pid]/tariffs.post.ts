import { SYSTEM_TARIFFS } from '../../../domain/pricing'
import type { TariffDef } from '../../../domain/types'

// Egyedi díjcsomag létrehozása (kód nélkül): a szerver minden paramétert ellenőriz.
export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user } = await requireCapability(event, pid, 'tariffs.manage')
  const b = await readBody<Record<string, any>>(event)
  const name = String(b.name ?? '').trim().slice(0, 60)
  if (!name) throw createError({ statusCode: 400, message: 'Kötelező mező: Név' })
  const kind = b.kind as TariffDef['kind']
  if (!['fix', 'indexed', 'tou', 'dynamic'].includes(kind)) throw createError({ statusCode: 400, message: 'Ismeretlen díjcsomag-típus' })
  const price = (v: unknown, label: string) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 200) throw createError({ statusCode: 400, message: `${label}: 0 és 200 Ft/kWh közötti érték kell` })
    return Math.round(n * 100) / 100
  }
  const def: Omit<TariffDef, 'id' | 'partnerId' | 'system'> = { name, kind }
  if (kind === 'fix') def.fixHufPerKwh = price(b.fixHufPerKwh, 'Fix ár')
  if (kind === 'indexed' || kind === 'dynamic') def.marginHufPerKwh = price(b.marginHufPerKwh ?? 0, 'Kereskedői díj')
  if (kind === 'tou') def.zoneHufPerKwh = { nappali: price(b.zoneHufPerKwh?.nappali, 'Nappali ár'), csucs: price(b.zoneHufPerKwh?.csucs, 'Csúcs ár'), volgy: price(b.zoneHufPerKwh?.volgy, 'Völgy ár') }
  if (b.monthlyFeeHuf !== undefined && b.monthlyFeeHuf !== '') {
    const fee = Number(b.monthlyFeeHuf)
    if (!Number.isFinite(fee) || fee < 0 || fee > 10_000_000) throw createError({ statusCode: 400, message: 'Havi díj: 0 és 10 000 000 Ft közötti érték kell' })
    def.monthlyFeeHuf = Math.round(fee)
  }
  const backend = useBackend()
  const existing = [...SYSTEM_TARIFFS, ...(await backend.listTariffs(pid))]
  if (existing.some(t => t.name.toLowerCase() === name.toLowerCase())) throw createError({ statusCode: 409, message: 'Ilyen nevű díjcsomag már van' })
  const rec = await backend.createTariff(pid, def, user.name)
  await backend.addAudit({ userId: user.id, partnerId: pid, action: `díjcsomag létrehozva: ${name}` })
  return rec
})
