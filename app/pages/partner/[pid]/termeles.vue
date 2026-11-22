<script setup lang="ts">
import type { ProductionRecord, SupplyPoint } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: production } = await useFetch<ProductionRecord[]>(`${base}/production`)
const { data: points } = await useFetch<SupplyPoint[]>(`${base}/supply-points`)

const label = (id: string) => points.value?.find(p => p.id === id)?.label ?? id
const nf = (n: number, d = 0) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: d }).format(n)
const huf = (n: number) => nf(n) + ' Ft'
const statusLabel = { tervezet: 'Tervezet', jovahagyva: 'Jóváhagyva', kifizetve: 'Kifizetve' } as const

const months = computed(() => [...new Set((production.value ?? []).map(p => p.month))].sort())
const chartItems = computed(() => months.value.map(m => ({
  label: shortMonth(m),
  value: (production.value ?? []).filter(p => p.month === m).reduce((s, p) => s + p.mwh, 0),
})))
const annualMwh = computed(() => (production.value ?? []).reduce((s, p) => s + p.mwh, 0))
const annualSettlement = computed(() => (production.value ?? []).reduce((s, p) => s + p.settlementHuf, 0))
const rows = computed(() => [...(production.value ?? [])].sort((a, b) => b.month.localeCompare(a.month) || a.supplyPointId.localeCompare(b.supplyPointId)))
</script>

<template>
  <div class="tiles">
    <div class="tile" data-testid="tile-annual-mwh"><h3>Éves termelés</h3><strong data-testid="annual-mwh">{{ nf(annualMwh) }} MWh</strong></div>
    <div class="tile" data-testid="tile-annual-settlement"><h3>Éves átvételi elszámolás</h3><strong>{{ huf(annualSettlement) }}</strong></div>
  </div>
  <section class="card">
    <BarChart :items="chartItems" unit="MWh" title="Havi termelés (összes blokk)" testid="production-chart" />
  </section>
  <section class="card">
    <h2>Átvételi elszámolás</h2>
    <p class="hint">Az elszámolt összeget mi fizetjük a partnernek: termelt energia × piaci ár + támogatási prémium − kiegyenlítő energia költsége.</p>
    <table>
      <thead><tr><th>Hónap</th><th>Blokk</th><th>MWh</th><th>Ár (Ft/MWh)</th><th>Prémium</th><th>Kiegyenlítés</th><th>Elszámolás</th><th>Állapot</th></tr></thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id" :data-testid="`production-${p.id}`">
          <td>{{ p.month }}</td>
          <td>{{ label(p.supplyPointId) }}</td>
          <td>{{ nf(p.mwh, 1) }}</td>
          <td>{{ nf(p.priceHufPerMwh) }}</td>
          <td>{{ p.premiumHuf ? huf(p.premiumHuf) : '–' }}</td>
          <td>{{ huf(-p.imbalanceHuf) }}</td>
          <td><strong>{{ huf(p.settlementHuf) }}</strong></td>
          <td data-testid="production-status">{{ statusLabel[p.status] }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
