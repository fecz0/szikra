// Napi menetrend benyújtása a következő napokra (day-ahead). Villany: alap MW + csúcsidei (8–20 h, hétköznap) többlet; gáz: napi MWh.
const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)

export default defineEventHandler(async (event) => {
  const pid = getRouterParam(event, 'pid') ?? ''
  const { user } = await requireCapability(event, pid, 'schedule.submit')
  const body = await readBody<{ date?: string, commodity?: string, baseMw?: number, peakMw?: number, dailyMwh?: number }>(event)
  const date = String(body.date ?? '')
  const today = new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today || date > addDays(today, 7)) {
    throw createError({ statusCode: 400, message: 'A menetrend a következő 7 napra nyújtható be' })
  }
  const num = (v: unknown, max: number) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > max) throw createError({ statusCode: 400, message: `Érvénytelen érték (0–${max})` })
    return Math.round(n * 10) / 10
  }
  let values: number[]
  let commodity: 'villany' | 'gaz'
  if (body.commodity === 'gaz') {
    commodity = 'gaz'
    values = [num(body.dailyMwh, 5000)]
  }
  else if (body.commodity === 'villany') {
    commodity = 'villany'
    const base = num(body.baseMw, 500)
    const peak = num(body.peakMw ?? 0, 500)
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay()
    const isWeekday = weekday >= 1 && weekday <= 5
    values = Array.from({ length: 24 }, (_, h) => base + (isWeekday && h >= 8 && h < 20 ? peak : 0))
  }
  else {
    throw createError({ statusCode: 400, message: 'Ismeretlen energiafajta' })
  }
  const b = useBackend()
  const rec = await b.submitSchedule(pid, { date, commodity, values, by: user.name })
  await b.addAudit({ userId: user.id, partnerId: pid, action: `menetrend benyújtva: ${commodity} ${date}` })
  return rec
})
