<script setup lang="ts">
import type { Deal } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
interface Credit { limitHuf: number, usedHuf: number, unpaidHuf: number, upcomingHuf: number, usedPct: number, guaranteeHuf: number, guaranteeExpiry: string | null, guaranteeDaysLeft: number | null }
const { data: deals, refresh } = await useFetch<Deal[]>(`${base}/deals`)
const { data: credit } = await useFetch<Credit | null>(`${base}/credit`, { default: () => null })
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canConfirm = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('deals.confirm'))

const status = ref('')
const commodity = ref('')
const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
const nf = (n: number, d = 0) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: d }).format(n)
const huf = (n: number) => `${nf(n)} Ft`
const mHuf = (n: number) => `${nf(n / 1e6, 1)} M Ft`
const statusLabel: Record<string, string> = { 'visszaigazolasra-var': 'Visszaigazolásra vár', 'visszaigazolva': 'Visszaigazolva', 'vitatott': 'Vitatott', 'teljesitve': 'Teljesítve' }
const valueHuf = (d: Deal) => d.totalMwh * d.priceEurMwh * d.fxHufPerEur
const rows = computed(() => (deals.value ?? []).filter(d => (!status.value || d.status === status.value) && (!commodity.value || d.commodity === commodity.value)))

async function confirm(id: string) {
  busy.value = id
  message.value = null
  try {
    await $fetch(`${base}/deals/${encodeURIComponent(id)}/confirm`, { method: 'POST' })
    message.value = { kind: 'ok', text: 'Az ügylet visszaigazolva' }
    await refresh()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen visszaigazolás' }
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <div v-if="credit" class="tiles">
    <div class="tile" data-testid="credit-tile">
      <h3>Hitelkeret</h3>
      <strong data-testid="credit-used-pct">{{ nf(credit.usedPct, 1) }}%</strong>
      <progress :value="Math.min(100, credit.usedPct)" max="100" :class="{ warn: credit.usedPct >= 80 }" aria-label="Hitelkeret-kihasználtság" />
      <p>{{ huf(credit.usedHuf) }} / {{ huf(credit.limitHuf) }}</p>
      <p class="hint">Nyitott számlák: {{ mHuf(credit.unpaidHuf) }} · következő 30 nap szállításai: {{ mHuf(credit.upcomingHuf) }}</p>
    </div>
    <div class="tile" data-testid="guarantee-tile">
      <h3>Bankgarancia</h3>
      <strong>{{ mHuf(credit.guaranteeHuf) }}</strong>
      <p>Lejárat: {{ credit.guaranteeExpiry ?? '–' }}</p>
    </div>
  </div>
  <p v-if="credit && credit.guaranteeDaysLeft !== null && credit.guaranteeDaysLeft < 120" class="warnbox" role="status" data-testid="guarantee-warning">
    A bankgarancia {{ credit.guaranteeDaysLeft > 0 ? `${credit.guaranteeDaysLeft} nap múlva lejár` : 'lejárt' }}: a hosszabbításról gondoskodni kell, különben a limit csökkenhet.
  </p>

  <section class="card">
    <h2>Ügyletek</h2>
    <div class="toolbar">
      <div>
        <label for="ds">Állapot</label>
        <select id="ds" v-model="status" data-testid="deal-filter-status">
          <option value="">Mind</option>
          <option v-for="(l, k) in statusLabel" :key="k" :value="k">{{ l }}</option>
        </select>
      </div>
      <div>
        <label for="dc">Energia</label>
        <select id="dc" v-model="commodity" data-testid="deal-filter-commodity">
          <option value="">Mind</option><option value="villany">Villany</option><option value="gaz">Gáz</option>
        </select>
      </div>
      <p class="hint" data-testid="deal-summary">{{ rows.length }} ügylet</p>
    </div>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">{{ message.text }}</p>
    <table class="wrap">
      <thead><tr><th>Kötés</th><th>Termék</th><th>Irány</th><th>Mennyiség</th><th>Szállítás</th><th>Ár (€/MWh)</th><th>Érték</th><th>Állapot</th><th /></tr></thead>
      <tbody>
        <tr v-for="d in rows" :key="d.id" :data-testid="`deal-${d.id}`">
          <td>{{ d.tradeDate }}</td>
          <td>{{ d.product }}</td>
          <td>{{ d.side === 'vetel' ? 'Vétel' : 'Eladás' }}</td>
          <td>{{ nf(d.volume) }} {{ d.volumeUnit }}<span class="hint"> · {{ nf(d.totalMwh) }} MWh</span></td>
          <td>{{ d.deliveryFrom }} – {{ d.deliveryTo }}</td>
          <td>{{ nf(d.priceEurMwh, 2) }}</td>
          <td>{{ mHuf(valueHuf(d)) }}</td>
          <td><span :class="['status', d.status]" data-testid="deal-status">{{ statusLabel[d.status] }}</span></td>
          <td><button v-if="d.status === 'visszaigazolasra-var' && canConfirm" :disabled="busy === d.id" data-testid="confirm" @click="confirm(d.id)">Visszaigazolás</button></td>
        </tr>
      </tbody>
    </table>
    <p class="hint">Eltérés esetén indítson <NuxtLink :to="`/partner/${pid}/ugyek/uj`">Ügylet-vita</NuxtLink> ügyet. Az ár EUR/MWh, a forint érték az ügylethez rögzített árfolyamon számolódik.</p>
  </section>
</template>
