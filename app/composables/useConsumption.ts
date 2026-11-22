import type { Reading } from '../../server/domain/types'

/** Kumulált mérőállásokból havi fogyasztás: a hónap utolsó állása - az előző állás. */
export function monthlyConsumption(readings: Reading[]): { month: string, value: number }[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.slice(1).map((r, i) => ({ month: r.date.slice(0, 7), value: r.value - sorted[i]!.value }))
}

export const shortMonth = (ym: string) => ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szep', 'okt', 'nov', 'dec'][Number(ym.slice(5)) - 1]!
