import type { Bundle } from './demo-data.ts'
import { buildChain, buildNuclear, buildSolarPark, buildWholesale } from './demo-data.ts'
import type { Dataset, Membership, PortalUser } from './types.ts'
import { emptyDataset } from './types.ts'

type LegacyName = 'okos-ipari' | 'elmaradt-szamla' | 'kartya-elutasitva' | 'rendezett-szamlak'
export type ScenarioName = LegacyName | 'kereskedelmi-lanc' | 'napelempark' | 'nagykereskedelem' | 'atomeromu'

type Fragment = Bundle

/**
 * Seed forgatókönyvek: egy forgatókönyv = egy teljes partner-csomag
 * (cég, fogyasztási helyek, számlák). Ugyanezt tölti be az ERPNext seed
 * (`erp/seed.ts`) és a memória-tár a tesztekben; a deploy-hoz ezekből készül a JSON snapshot.
 */
const legacyScenarios: Record<LegacyName, (id: string) => Omit<Fragment, 'readings' | 'production' | 'deals' | 'schedule'>> = {
  'okos-ipari': id => ({
    partner: { id, name: `Napfény Energia Kft. (${id})`, taxNumber: '12345678-2-41', address: '1011 Budapest, Minta utca 1.', segment: 'ipari', contractNo: `SZ-${id}-01` },
    supplyPoints: [
      { id: `${id}-E1`, partnerId: id, type: 'villany', pod: `HU-DEMO-E-${id}`, address: '1011 Budapest, Minta utca 1.', meterSerial: 'E-4411', smart: true, lastReading: 48210, lastReadingDate: '2026-10-31', unit: 'kWh' },
      { id: `${id}-G1`, partnerId: id, type: 'gaz', pod: `HU-DEMO-G-${id}`, address: '1011 Budapest, Minta utca 1.', meterSerial: 'G-9020', smart: true, lastReading: 12600, lastReadingDate: '2026-10-31', unit: 'm3' },
    ],
    invoices: [
      { id: `${id}-INV1`, partnerId: id, supplyPointId: `${id}-E1`, period: '2026. október', amountHuf: 1845000, issueDate: '2026-11-05', dueDate: '2026-11-25', status: 'open' },
      { id: `${id}-INV2`, partnerId: id, supplyPointId: `${id}-G1`, period: '2026. október', amountHuf: 3299000, issueDate: '2026-11-05', dueDate: '2026-11-25', status: 'open' },
    ],
  }),

  'elmaradt-szamla': id => ({
    partner: { id, name: `Késő Kereskedelmi Zrt. (${id})`, taxNumber: '23456789-2-09', address: '4025 Debrecen, Határidő köz 7.', segment: 'kereskedelmi', contractNo: `SZ-${id}-02` },
    supplyPoints: [
      { id: `${id}-E1`, partnerId: id, type: 'villany', pod: `HU-DEMO-E-${id}`, address: '4025 Debrecen, Határidő köz 7.', meterSerial: 'E-7731', smart: false, lastReading: 90330, lastReadingDate: '2026-10-31', unit: 'kWh' },
    ],
    invoices: [
      { id: `${id}-INV1`, partnerId: id, supplyPointId: `${id}-E1`, period: '2026. augusztus', amountHuf: 2410000, issueDate: '2026-09-01', dueDate: '2026-09-20', status: 'overdue' },
      { id: `${id}-INV2`, partnerId: id, supplyPointId: `${id}-E1`, period: '2026. szeptember', amountHuf: 2180000, issueDate: '2026-10-01', dueDate: '2026-10-20', status: 'overdue' },
    ],
  }),

  'kartya-elutasitva': id => ({
    partner: { id, name: `Pech Gázfogyasztó Bt. (${id})`, taxNumber: '34567890-2-02', address: '7621 Pécs, Elutasított tér 3.', segment: 'kozuzemi', contractNo: `SZ-${id}-03`, cardDeclines: true },
    supplyPoints: [
      { id: `${id}-G1`, partnerId: id, type: 'gaz', pod: `HU-DEMO-G-${id}`, address: '7621 Pécs, Elutasított tér 3.', meterSerial: 'G-3318', smart: false, lastReading: 8800, lastReadingDate: '2026-10-31', unit: 'm3' },
    ],
    invoices: [
      { id: `${id}-INV1`, partnerId: id, supplyPointId: `${id}-G1`, period: '2026. október', amountHuf: 4120000, issueDate: '2026-11-05', dueDate: '2026-11-25', status: 'open' },
    ],
  }),

  'rendezett-szamlak': id => ({
    partner: { id, name: `Rendes Ipari Park Kft. (${id})`, taxNumber: '45678901-2-08', address: '9021 Győr, Pontos köz 12.', segment: 'ipari', contractNo: `SZ-${id}-04` },
    supplyPoints: [
      { id: `${id}-E1`, partnerId: id, type: 'villany', pod: `HU-DEMO-E-${id}`, address: '9021 Győr, Pontos köz 12.', meterSerial: 'E-1208', smart: true, lastReading: 22100, lastReadingDate: '2026-10-31', unit: 'kWh' },
    ],
    invoices: [
      { id: `${id}-INV1`, partnerId: id, supplyPointId: `${id}-E1`, period: '2026. szeptember', amountHuf: 1520000, issueDate: '2026-10-01', dueDate: '2026-10-20', status: 'paid' },
      { id: `${id}-INV2`, partnerId: id, supplyPointId: `${id}-E1`, period: '2026. október', amountHuf: 1610000, issueDate: '2026-11-05', dueDate: '2026-11-25', status: 'paid' },
    ],
  }),
}

export const scenarios: Record<ScenarioName, (id: string) => Fragment> = {
  ...(Object.fromEntries(Object.entries(legacyScenarios).map(([k, make]) => [k, (id: string): Fragment => ({ readings: [], production: [], deals: [], schedule: [], ...make(id) })])) as Record<LegacyName, (id: string) => Fragment>),
  'kereskedelmi-lanc': id => buildChain(id, `Tisza Kereskedelmi Lánc Zrt. (${id})`, 3),
  'napelempark': id => buildSolarPark(id, `Alföldi Napenergia Kft. (${id})`),
  'nagykereskedelem': id => buildWholesale(id, `Duna Trade Kft. (${id})`),
  'atomeromu': id => buildNuclear(id, `Dunai Atomerőmű Zrt. (${id})`),
}

/** Fix demó partnerek (azonosítók a snapshotban is stabilak). */
export const demoPartnerIds: Record<ScenarioName, string> = {
  'okos-ipari': 'DEMO-OKOS',
  'elmaradt-szamla': 'DEMO-ELMARADT',
  'kartya-elutasitva': 'DEMO-KARTYA',
  'rendezett-szamlak': 'DEMO-RENDEZETT',
  'kereskedelmi-lanc': 'DEMO-LANC',
  'napelempark': 'DEMO-NAPELEM',
  'nagykereskedelem': 'DEMO-NAGYKER',
  'atomeromu': 'DEMO-ATOM',
}

export const demoUsers: PortalUser[] = [
  { id: 'DEMO-ADMIN', name: 'Kovács Anna', email: 'anna@demo.szikra.test', note: 'Három cég: adminisztrátor az okosmérős cégnél, olvasó a lejárt számlásnál, pénzügyi a kártyás cégnél' },
  { id: 'DEMO-PENZUGY', name: 'Nagy Péter', email: 'peter@demo.szikra.test', note: 'Pénzügyi szerepkör: számlák és fizetés, mérőállást nem közölhet' },
  { id: 'DEMO-MUSZAKI', name: 'Szabó Mária', email: 'maria@demo.szikra.test', note: 'Műszaki szerepkör: fogyasztási helyek, mérőállás, ajánlatkérés; számlát nem lát' },
  { id: 'DEMO-TERMELO', name: 'Kiss Zoltán', email: 'zoltan@demo.szikra.test', note: 'Napelempark-üzemeltető: termelés, átvételi elszámolás, leállás- és kapacitásügyek' },
  { id: 'DEMO-KERESKEDO', name: 'Varga Dávid', email: 'david@demo.szikra.test', note: 'Nagykereskedelmi kereskedő: ügyletek visszaigazolása, napi menetrend benyújtása, limit' },
  { id: 'DEMO-ELSZAMOLAS', name: 'Szűcs Réka', email: 'reka@demo.szikra.test', note: 'Elszámolás (pénzügy): a nagykereskedő számlái és limitje, és a napelempark átvételi elszámolása' },
  { id: 'DEMO-UZEMVEZETO', name: 'Farkas Imre', email: 'imre@demo.szikra.test', note: 'Napelempark üzemvezető (műszaki): termelés, leállás-bejelentés; ügyletet és számlát nem lát' },
  { id: 'DEMO-VEZETO', name: 'Dr. Balogh Katalin', email: 'katalin@demo.szikra.test', note: 'Cégcsoport-vezető: adminisztrátor a nagykereskedőnél, olvasó a láncnál és a napelemparknál' },
  { id: 'DEMO-ATOMVEZETO', name: 'Dr. Horváth Péter', email: 'peter.h@demo.szikra.test', note: 'Atomerőmű vezérigazgató (admin): leállások és nagy összegű elszámolások jóváhagyása (négy szem: az egyik jóváhagyó)' },
  { id: 'DEMO-MEGFELELO', name: 'Kovács Judit', email: 'judit@demo.szikra.test', note: 'Megfelelőségi felelős: auditnapló, leállások és elszámolások második jóváhagyója; mást nem módosíthat' },
  { id: 'DEMO-ATOMUZEM', name: 'Gál Tibor', email: 'tibor@demo.szikra.test', note: 'Atomerőmű üzemvezető (műszaki): leállás javaslata; jóváhagyni nem tud' },
  { id: 'DEMO-OLVASO', name: 'Tóth Gábor', email: 'gabor@demo.szikra.test', note: 'Csak olvasó: minden megtekinthető, semmi nem indítható' },
]

export const demoMemberships: Membership[] = [
  { userId: 'DEMO-ADMIN', partnerId: 'DEMO-OKOS', role: 'admin' },
  { userId: 'DEMO-ADMIN', partnerId: 'DEMO-ELMARADT', role: 'olvaso' },
  { userId: 'DEMO-ADMIN', partnerId: 'DEMO-KARTYA', role: 'penzugy' },
  { userId: 'DEMO-ADMIN', partnerId: 'DEMO-LANC', role: 'admin' },
  { userId: 'DEMO-TERMELO', partnerId: 'DEMO-NAPELEM', role: 'admin' },
  { userId: 'DEMO-KERESKEDO', partnerId: 'DEMO-NAGYKER', role: 'kereskedo' },
  { userId: 'DEMO-ELSZAMOLAS', partnerId: 'DEMO-NAGYKER', role: 'penzugy' },
  { userId: 'DEMO-ELSZAMOLAS', partnerId: 'DEMO-NAPELEM', role: 'penzugy' },
  { userId: 'DEMO-UZEMVEZETO', partnerId: 'DEMO-NAPELEM', role: 'muszaki' },
  { userId: 'DEMO-ATOMVEZETO', partnerId: 'DEMO-ATOM', role: 'admin' },
  { userId: 'DEMO-MEGFELELO', partnerId: 'DEMO-ATOM', role: 'megfelelo' },
  { userId: 'DEMO-ATOMUZEM', partnerId: 'DEMO-ATOM', role: 'muszaki' },
  { userId: 'DEMO-ELSZAMOLAS', partnerId: 'DEMO-ATOM', role: 'penzugy' },
  { userId: 'DEMO-VEZETO', partnerId: 'DEMO-ATOM', role: 'olvaso' },
  { userId: 'DEMO-VEZETO', partnerId: 'DEMO-NAGYKER', role: 'admin' },
  { userId: 'DEMO-VEZETO', partnerId: 'DEMO-LANC', role: 'olvaso' },
  { userId: 'DEMO-VEZETO', partnerId: 'DEMO-NAPELEM', role: 'olvaso' },
  { userId: 'DEMO-PENZUGY', partnerId: 'DEMO-ELMARADT', role: 'penzugy' },
  { userId: 'DEMO-PENZUGY', partnerId: 'DEMO-KARTYA', role: 'penzugy' },
  { userId: 'DEMO-MUSZAKI', partnerId: 'DEMO-OKOS', role: 'muszaki' },
  { userId: 'DEMO-OLVASO', partnerId: 'DEMO-RENDEZETT', role: 'olvaso' },
]

export function fixedDemoDataset(): Dataset {
  const ds = emptyDataset()
  for (const [name, id] of Object.entries(demoPartnerIds) as [ScenarioName, string][]) {
    // a fix demóban a teljes lánc (8 telephely), a tesztekben a kicsi változat
    const f = name === 'kereskedelmi-lanc' ? buildChain(id, `Tisza Kereskedelmi Lánc Zrt. (${id})`) : scenarios[name](id)
    // A fix demó partner neve szép, azonosító-utótag nélkül.
    f.partner.name = f.partner.name.replace(` (${id})`, '')
    ds.partners.push(f.partner)
    ds.supplyPoints.push(...f.supplyPoints)
    ds.readings.push(...f.readings)
    ds.production.push(...f.production)
    ds.deals.push(...f.deals)
    ds.schedule.push(...f.schedule)
    ds.outages.push(...(f.outages ?? []))
    ds.audit.push(...(f.audit ?? []))
    ds.invoices.push(...f.invoices)
  }
  ds.users.push(...demoUsers)
  ds.memberships.push(...demoMemberships)
  return ds
}

/** Teszt-seed: egy új partner + egy új, egyedi felhasználó adott szerepkörrel. */
export function seedDataset(scenario: ScenarioName, role: Membership['role'], uid: string): { dataset: Dataset, userId: string, partnerId: string } {
  const f = scenarios[scenario](uid)
  const userId = `U-${uid}`
  const ds = emptyDataset()
  ds.partners.push(f.partner)
  ds.supplyPoints.push(...f.supplyPoints)
  ds.readings.push(...f.readings)
  ds.production.push(...f.production)
  ds.deals.push(...f.deals)
  ds.schedule.push(...f.schedule)
  ds.outages.push(...(f.outages ?? []))
  ds.audit.push(...(f.audit ?? []))
  ds.invoices.push(...f.invoices)
  ds.users.push({ id: userId, name: 'Teszt Elek', email: `${uid}@teszt.szikra.test`, note: 'teszt' })
  ds.memberships.push({ userId, partnerId: f.partner.id, role })
  return { dataset: ds, userId, partnerId: f.partner.id }
}
