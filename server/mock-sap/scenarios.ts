import type { SapCustomer } from './types'

type Scenario = (id: string) => SapCustomer

/**
 * Seed forgatókönyvek: egy forgatókönyv = egy teljes SAP-objektumcsomag
 * (ügyfél, szerződéses számla, mérők, számlák, fizetési mód).
 * Ami valós SAP-ban 2-3 nap kézi beállítás, az itt egyetlen hívás.
 */
export const scenarios: Record<string, Scenario> = {
  'okosmero-gaz-villany': id => ({
    id,
    name: 'Teszt Elek',
    address: '1011 Budapest, Minta utca 1.',
    contractAccount: `CA-${id}`,
    meters: [
      { id: `${id}-E1`, type: 'villany', smart: true, pod: 'HU-DEMO-E-0001', lastReading: 4821, unit: 'kWh' },
      { id: `${id}-G1`, type: 'gaz', smart: true, pod: 'HU-DEMO-G-0001', lastReading: 1260, unit: 'm3' },
    ],
    bills: [
      { id: `${id}-B1`, meterId: `${id}-E1`, period: '2026. október', amountHuf: 18450, dueDate: '2026-11-20', status: 'open' },
      { id: `${id}-B2`, meterId: `${id}-G1`, period: '2026. október', amountHuf: 32990, dueDate: '2026-11-20', status: 'open' },
    ],
    paymentMethod: { kind: 'card', label: 'Bankkártya **** 4242' },
  }),

  'elmaradt-szamla': id => ({
    id,
    name: 'Késő Kata',
    address: '4025 Debrecen, Határidő köz 7.',
    contractAccount: `CA-${id}`,
    meters: [
      { id: `${id}-E1`, type: 'villany', smart: false, pod: 'HU-DEMO-E-0002', lastReading: 9033, unit: 'kWh' },
    ],
    bills: [
      { id: `${id}-B1`, meterId: `${id}-E1`, period: '2026. augusztus', amountHuf: 24100, dueDate: '2026-09-20', status: 'overdue' },
      { id: `${id}-B2`, meterId: `${id}-E1`, period: '2026. szeptember', amountHuf: 21800, dueDate: '2026-10-20', status: 'overdue' },
    ],
    paymentMethod: { kind: 'transfer', label: 'Átutalás' },
  }),

  'kartya-elutasitva': id => ({
    id,
    name: 'Pech Péter',
    address: '7621 Pécs, Elutasított tér 3.',
    contractAccount: `CA-${id}`,
    meters: [
      { id: `${id}-G1`, type: 'gaz', smart: false, pod: 'HU-DEMO-G-0003', lastReading: 880, unit: 'm3' },
    ],
    bills: [
      { id: `${id}-B1`, meterId: `${id}-G1`, period: '2026. október', amountHuf: 41200, dueDate: '2026-11-20', status: 'open' },
    ],
    paymentMethod: { kind: 'card', label: 'Bankkártya **** 0002', declines: true },
  }),
}
