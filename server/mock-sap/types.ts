export type Energy = 'villany' | 'gaz'

export interface Meter {
  id: string
  type: Energy
  smart: boolean
  pod: string // POD (villany) / EIC-kód (gáz) helyett demó azonosító
  lastReading: number
  unit: 'kWh' | 'm3'
}

export interface Bill {
  id: string
  meterId: string
  period: string
  amountHuf: number
  dueDate: string
  status: 'open' | 'paid' | 'overdue'
}

export interface PaymentMethod {
  kind: 'card' | 'transfer' | 'direct-debit'
  label: string
  /** Mock: a kártyaterhelés elutasítását szimulálja */
  declines?: boolean
}

export interface SapCustomer {
  id: string
  name: string
  address: string
  contractAccount: string
  meters: Meter[]
  bills: Bill[]
  paymentMethod: PaymentMethod
}
