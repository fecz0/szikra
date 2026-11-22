import { dealMwh } from '../domain/demo-data'
import { VAT_PCT } from '../domain/tariffs'
import type { Deal, Invoice, Partner } from '../domain/types'

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10)

/**
 * Hitelkeret-kihasználtság: nem kiegyenlített számlák + a következő 30 nap visszaigazolt vételi szállításainak
 * értéke (ÁFÁ-val). A bankgarancia lejáratáig hátralévő napok külön jelennek meg.
 */
export function creditPosition(partner: Partner, deals: Deal[], invoices: Invoice[], today = new Date().toISOString().slice(0, 10)) {
  const limitHuf = partner.creditLimitHuf ?? 0
  const unpaidHuf = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amountHuf, 0)
  const horizon = addDays(today, 30)
  let upcoming = 0
  for (const d of deals) {
    if (d.side !== 'vetel' || d.status !== 'visszaigazolva') continue
    const from = d.deliveryFrom > today ? d.deliveryFrom : today
    const to = d.deliveryTo < horizon ? d.deliveryTo : horizon
    if (from > to) continue
    upcoming += dealMwh(d, from, to) * d.priceEurMwh * d.fxHufPerEur
  }
  const upcomingHuf = Math.round(upcoming * (1 + VAT_PCT / 100))
  const usedHuf = unpaidHuf + upcomingHuf
  return {
    limitHuf, usedHuf, unpaidHuf, upcomingHuf,
    usedPct: limitHuf ? Math.round((usedHuf / limitHuf) * 1000) / 10 : 0,
    guaranteeHuf: partner.guaranteeHuf ?? 0,
    guaranteeExpiry: partner.guaranteeExpiry ?? null,
    guaranteeDaysLeft: partner.guaranteeExpiry ? Math.round((Date.parse(partner.guaranteeExpiry) - Date.parse(today)) / 86_400_000) : null,
  }
}
