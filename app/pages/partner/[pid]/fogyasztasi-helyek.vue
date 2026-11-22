<script setup lang="ts">
import type { Reading, SupplyPoint } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: points } = await useFetch<SupplyPoint[]>(`${base}/supply-points`)
const { data: readings } = await useFetch<Reading[]>(`${base}/readings`)

const selected = ref(points.value?.[0]?.id ?? '')
const current = computed(() => points.value?.find(p => p.id === selected.value))
const series = computed(() => monthlyConsumption((readings.value ?? []).filter(r => r.supplyPointId === selected.value)))
const producing = computed(() => current.value?.direction === 'termeles')
const chartItems = computed(() => series.value.map(s => ({ label: shortMonth(s.month), value: current.value?.unit === 'kWh' ? s.value / 1000 : s.value })))
const chartUnit = computed(() => (current.value?.unit === 'kWh' ? 'MWh' : 'm³'))
const nf = (n: number) => new Intl.NumberFormat('hu-HU').format(n)
</script>

<template>
  <section class="card">
    <h2>Fogyasztási és termelési helyek</h2>
    <ul class="list">
      <li v-for="s in points" :key="s.id" :data-testid="`supply-${s.type}`">
        <strong>{{ s.label ?? (s.type === 'villany' ? 'Villany' : 'Gáz') }}</strong>
        <span class="tag">{{ s.type === 'villany' ? 'Villany' : 'Gáz' }}</span>
        <span class="chip">{{ s.smart ? 'Okosmérő' : 'Hagyományos mérő' }}</span>
        <span v-if="s.tariff" class="tag">{{ s.tariff }}</span>
        <span v-if="s.capacityKw" class="tag">{{ nf(s.capacityKw / 1000) }} MW</span>
        <code>{{ s.pod }}</code>
        <span>{{ s.address }}</span>
        <span>Utolsó állás: {{ nf(s.lastReading) }} {{ s.unit }} ({{ s.lastReadingDate }})</span>
      </li>
    </ul>
  </section>

  <section v-if="points?.length" class="card">
    <h2>{{ producing ? 'Havi termelés' : 'Havi fogyasztás' }}</h2>
    <div class="toolbar">
      <div>
        <label for="sp">Hely</label>
        <select id="sp" v-model="selected" data-testid="supply-select">
          <option v-for="s in points" :key="s.id" :value="s.id">{{ s.label ?? s.pod }} · {{ s.type === 'villany' ? 'villany' : 'gáz' }}</option>
        </select>
      </div>
    </div>
    <BarChart :items="chartItems" :unit="chartUnit" :title="producing ? 'Termelés' : 'Fogyasztás'" testid="consumption-chart" />
  </section>
</template>
