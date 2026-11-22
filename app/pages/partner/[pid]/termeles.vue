<script setup lang="ts">
import { REQUIRED_APPROVALS, needsFourEyes } from '../../../../server/domain/approvals'
import type { ProductionRecord, SupplyPoint } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: production } = await useFetch<ProductionRecord[]>(`${base}/production`)
const { data: points } = await useFetch<SupplyPoint[]>(`${base}/supply-points`)

const { data: me } = await useFetch<{ user: { id: string }, companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canApprove = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('settlements.approve'))
const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
// havi csoportok, amelyek négy szem jóváhagyásra várnak
const awaiting = computed(() => [...new Set((production.value ?? []).filter(p => p.status === 'tervezet' && needsFourEyes(p.settlementHuf)).map(p => p.month))].sort().map(month => {
  const recs = (production.value ?? []).filter(p => p.month === month && p.status === 'tervezet' && needsFourEyes(p.settlementHuf))
  const approvers = [...new Map(recs.flatMap(r => r.approvals ?? []).map(a => [a.userId, a.name])).values()]
  const mineDone = recs.every(r => (r.approvals ?? []).some(a => a.userId === me.value?.user.id))
  return { month, total: recs.reduce((x, r) => x + r.settlementHuf, 0), approvers, mineDone }
}))
async function approveMonth(month: string) {
  busy.value = month
  message.value = null
  try {
    await $fetch(`${base}/settlements/approve`, { method: 'POST', body: { month } })
    message.value = { kind: 'ok', text: `A(z) ${month} elszámolás jóváhagyása rögzítve` }
    await refreshNuxtData()
    production.value = await $fetch<ProductionRecord[]>(`${base}/production`)
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen jóváhagyás' }
  }
  finally {
    busy.value = null
  }
}
const hoursIn = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0)).getUTCDate() * 24
const capacityFactor = (p: ProductionRecord) => {
  const kw = points.value?.find(x => x.id === p.supplyPointId)?.capacityKw
  return kw && kw >= 100_000 ? Math.round((p.mwh / ((kw / 1000) * hoursIn(p.month))) * 1000) / 10 : null
}
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
  <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'" data-testid="settlement-message">{{ message.text }}</p>
  <section v-if="awaiting.length" class="card" data-testid="approvals-card">
    <h2>Jóváhagyásra váró elszámolások</h2>
    <p class="hint">{{ nf(1000) }} M Ft feletti havi elszámoláshoz két különböző jóváhagyó kell ({{ REQUIRED_APPROVALS }}). </p>
    <ul class="list">
      <li v-for="a in awaiting" :key="a.month" :data-testid="`awaiting-${a.month}`">
        <strong>{{ a.month }}</strong>
        <span>{{ huf(a.total) }}</span>
        <span class="approvals"><span v-for="n in a.approvers" :key="n" class="tag">{{ n }}</span><span v-if="!a.approvers.length" class="hint">még nincs jóváhagyás</span></span>
        <button v-if="canApprove && !a.mineDone" :disabled="busy === a.month" data-testid="approve-settlement" @click="approveMonth(a.month)">Jóváhagyás</button>
        <span v-else-if="canApprove" class="hint" data-testid="settlement-blocked">Ezt már jóváhagyta; másik jóváhagyó kell</span>
      </li>
    </ul>
  </section>
  <section class="card">
    <h2>Átvételi elszámolás</h2>
    <p class="hint">Az elszámolt összeget mi fizetjük a partnernek: termelt energia × piaci ár + támogatási prémium − kiegyenlítő energia költsége.</p>
    <table class="wrap">
      <thead><tr><th>Hónap</th><th>Blokk</th><th>MWh</th><th>Ár (Ft/MWh)</th><th>Prémium</th><th>Kiegyenlítés</th><th>Elszámolás</th><th>Kihasználtság</th><th>Állapot</th></tr></thead>
      <tbody>
        <tr v-for="p in rows" :key="p.id" :data-testid="`production-${p.id}`">
          <td>{{ p.month }}</td>
          <td>{{ label(p.supplyPointId) }}</td>
          <td>{{ nf(p.mwh, 1) }}</td>
          <td>{{ nf(p.priceHufPerMwh) }}</td>
          <td>{{ p.premiumHuf ? huf(p.premiumHuf) : '–' }}</td>
          <td>{{ huf(-p.imbalanceHuf) }}</td>
          <td><strong>{{ huf(p.settlementHuf) }}</strong></td>
          <td>{{ capacityFactor(p) === null ? '–' : `${nf(capacityFactor(p)!, 1)}%` }}</td>
          <td data-testid="production-status">{{ statusLabel[p.status] }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
