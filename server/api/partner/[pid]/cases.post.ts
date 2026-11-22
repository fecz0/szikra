import { caseTypes } from '../../../domain/case-types'
import type { CaseTypeId } from '../../../domain/types'

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const body = await readBody<{ type?: string, fields?: Record<string, string> }>(event)
  const def = caseTypes[body.type as CaseTypeId]
  if (!def) throw createError({ statusCode: 400, message: 'Ismeretlen ügytípus' })
  // az ügytípus saját jogosultságot kér (pl. mérőállás: supply.reading)
  const { user } = await requireCapability(event, pid, def.capability)

  const fields: Record<string, string> = {}
  for (const f of def.fields) {
    const v = String(body.fields?.[f.key] ?? '').trim().slice(0, 2000)
    if (f.required && !v) throw createError({ statusCode: 400, message: `Kötelező mező: ${f.label}` })
    if (f.kind === 'number' && v && Number.isNaN(Number(v))) throw createError({ statusCode: 400, message: `${f.label}: számot adjon meg` })
    fields[f.key] = v
  }
  const b = useBackend()
  // hivatkozott számla / fogyasztási hely a saját cégé legyen
  if (fields.invoice && !(await b.listInvoices(pid)).some(i => i.id === fields.invoice)) throw createError({ statusCode: 400, message: 'Ismeretlen számla' })
  if (fields.supply && !(await b.listSupplyPoints(pid)).some(s => s.id === fields.supply)) throw createError({ statusCode: 400, message: 'Ismeretlen fogyasztási hely' })

  const rec = await b.createCase({ partnerId: pid, type: def.id, subject: def.label, by: user.name, fields })
  await b.addAudit({ userId: user.id, partnerId: pid, action: `ügy indítva: ${def.label} (${rec.id})` })
  return rec
})
