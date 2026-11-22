import type { InvoiceLine } from './types.ts'

/**
 * Magyar vállalkozói energiaszámla tételei.
 *
 * VALÓS (forrás: E.ON, a villamosenergia-elosztók által 2026. január 1-től alkalmazható rendszerhasználati díjak,
 * MEKH H2995/2025 határozat; a számla szerkezete az E.ON vállalkozói elszámoló számla magyarázója alapján):
 *   átviteli forgalmi díj, elosztói alapdíj / lekötött teljesítménydíj / forgalmi díj / meddő energia díj,
 *   zónaidők: nappali 6–17, csúcs 17–22, völgy 22–6.
 * DEMÓ-érték (nem hiteles forrásból): energiadíjak, pénzeszközök, jövedéki adó, gázdíjak.
 * Éles használat előtt a MEKH aktuális határozatával és a kereskedő számlamagyarázójával egyeztetni kell.
 */
export const NETWORK_SOURCE = 'E.ON elosztói rendszerhasználati díjak, 2026. január 1-től (MEKH H2995/2025)'

export type NetworkCategory = 'KIF IV.' | 'KIF III.' | 'KÖF/KIF III.' | 'KÖF'

export interface NetworkTariff {
  category: NetworkCategory
  label: string
  /** Ft/csatlakozási pont/év */
  baseFeePerYear: number
  /** Ft/kW/év (lekötött teljesítmény), 0 ha nincs */
  capacityFeePerKwYear: number
  /** Ft/kWh (a KIF IV.-nél zónánként azonos) */
  trafficFeePerKwh: number
  /** Ft/kVArh */
  reactiveFeePerKvarh: number
}

export const NETWORK: Record<NetworkCategory, NetworkTariff> = {
  'KIF IV.': { category: 'KIF IV.', label: 'Kisfeszültségű okos mérős (KIF IV.)', baseFeePerYear: 1446, capacityFeePerKwYear: 0, trafficFeePerKwh: 20.01, reactiveFeePerKvarh: 5.47 },
  'KIF III.': { category: 'KIF III.', label: 'Kisfeszültségű idősoros (KIF III.)', baseFeePerYear: 72168, capacityFeePerKwYear: 13248, trafficFeePerKwh: 22.20, reactiveFeePerKvarh: 5.47 },
  'KÖF/KIF III.': { category: 'KÖF/KIF III.', label: 'Közép/Kisfeszültségű csatlakozás (KÖF/KIF III.)', baseFeePerYear: 72168, capacityFeePerKwYear: 16608, trafficFeePerKwh: 14.92, reactiveFeePerKvarh: 5.47 },
  'KÖF': { category: 'KÖF', label: 'Középfeszültségű csatlakozás (KÖF)', baseFeePerYear: 216504, capacityFeePerKwYear: 15924, trafficFeePerKwh: 8.39, reactiveFeePerKvarh: 3.95 },
}

/** Átviteli forgalmi díj, Ft/kWh (az elosztóhálózatra csatlakozóknál). */
export const TRANSMISSION_FEE_PER_KWH = 3.39
export const ZONES = { nappali: '6–17 óra', csucs: '17–22 óra', volgy: '22–6 óra' } as const
export const VAT_PCT = 27

// ---- demó-értékek ----
export const EXCISE_PER_KWH = 0.03 // jövedéki adó (validálandó)
export const FUNDS_PER_KWH = 1.1 // pénzeszközök (KÁT/METÁR), demó
export const FIX_PRICE = 38.9 // Ft/kWh, „Ipari fix 2026”
export const TRADER_MARGIN = 3.2 // Ft/kWh, „Piaci követő”: tőzsdei ár + kereskedői díj
export const ZONE_PRICE = { nappali: 41.2, csucs: 52.6, volgy: 31.4 } // Ft/kWh, „Kereskedelmi csúcs-völgy”

/** HUPX-jellegű havi átlag, Ft/MWh (2025-11 … 2026-10); a „Piaci követő” és a dinamikus díjcsomag alapja (demó-érték). */
export const HUPX_MONTHLY_HUF_MWH = [46000, 44000, 38000, 33000, 30000, 31000, 36000, 37000, 38000, 41000, 45000, 48000] // index: január = 0
export const hupxBase = (ym: string) => HUPX_MONTHLY_HUF_MWH[Number(ym.slice(5)) - 1]!

export interface Zones { nappali: number, csucs: number, volgy: number }

const line = (code: string, label: string, category: InvoiceLine['category'], quantity: number, unit: string, unitPrice: number): InvoiceLine =>
  ({ code, label, category, quantity: Math.round(quantity * 1000) / 1000, unit, unitPrice: Math.round(unitPrice * 10000) / 10000, amountHuf: Math.round(quantity * unitPrice) })

export function electricityLines(o: { zones: Zones, tariff: string, hupxHufPerMwh: number, contractedKw: number, category: NetworkCategory }): InvoiceLine[] {
  const kwh = o.zones.nappali + o.zones.csucs + o.zones.volgy
  const n = NETWORK[o.category]
  const energy: InvoiceLine[] = o.tariff === 'Piaci követő'
    ? [line('EN-HUPX', 'Tőzsdei energiaár (HUPX havi átlag)', 'energia', kwh, 'kWh', o.hupxHufPerMwh / 1000), line('EN-MARZS', 'Kereskedői díj', 'energia', kwh, 'kWh', TRADER_MARGIN)]
    : o.tariff === 'Kereskedelmi csúcs-völgy'
      ? [line('EN-NAP', 'Villamos energia, nappali (6–17)', 'energia', o.zones.nappali, 'kWh', ZONE_PRICE.nappali), line('EN-CSUCS', 'Villamos energia, csúcs (17–22)', 'energia', o.zones.csucs, 'kWh', ZONE_PRICE.csucs), line('EN-VOLGY', 'Villamos energia, völgy (22–6)', 'energia', o.zones.volgy, 'kWh', ZONE_PRICE.volgy)]
      : [line('EN-FIX', 'Villamos energia (fix ár)', 'energia', kwh, 'kWh', FIX_PRICE)]
  const network: InvoiceLine[] = [
    line('RH-ATV', 'Átviteli forgalmi díj', 'rendszerhasznalat', kwh, 'kWh', TRANSMISSION_FEE_PER_KWH),
    line('RH-ALAP', 'Elosztói alapdíj', 'rendszerhasznalat', 1, 'hó', Math.round(n.baseFeePerYear / 12)),
    ...(n.capacityFeePerKwYear ? [line('RH-TELJ', 'Elosztói lekötött teljesítménydíj', 'rendszerhasznalat', o.contractedKw, 'kW (hó)', n.capacityFeePerKwYear / 12)] : []),
    line('RH-FORG', 'Elosztói forgalmi díj', 'rendszerhasznalat', kwh, 'kWh', n.trafficFeePerKwh),
  ]
  const other: InvoiceLine[] = [
    line('PE-KAT', 'Pénzeszközök (KÁT/METÁR)', 'penzeszkoz-ado', kwh, 'kWh', FUNDS_PER_KWH),
    line('AD-JOV', 'Jövedéki adó', 'penzeszkoz-ado', kwh, 'kWh', EXCISE_PER_KWH),
  ]
  return [...energy, ...network, ...other]
}

/** Földgáz: a díjelemek szerkezete valós (energia, szállítási és elosztási forgalmi díj, elosztási alap- és kapacitásdíj), az értékek demó. */
export function gasLines(o: { m3: number, contractedKwhH: number }): InvoiceLine[] {
  return [
    line('GAZ-EN', 'Földgáz energiadíj', 'energia', o.m3, 'm³', 228),
    line('GAZ-SZALL', 'Szállítási forgalmi díj', 'rendszerhasznalat', o.m3, 'm³', 6.4),
    line('GAZ-ELOSZT-FORG', 'Elosztási forgalmi díj', 'rendszerhasznalat', o.m3, 'm³', 41),
    line('GAZ-ELOSZT-KAP', 'Elosztási kapacitásdíj', 'rendszerhasznalat', o.contractedKwhH, 'kWh/h (hó)', 100),
    line('GAZ-ELOSZT-ALAP', 'Elosztási alapdíj', 'rendszerhasznalat', 1, 'hó', 9800),
  ]
}

export function totals(lines: InvoiceLine[]) {
  const net = lines.reduce((s, l) => s + l.amountHuf, 0)
  const vat = Math.round(net * VAT_PCT / 100)
  return { net, vat, gross: net + vat }
}
