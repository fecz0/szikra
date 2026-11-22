<script setup lang="ts">
import type { ScheduleDay } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: schedule, refresh } = await useFetch<ScheduleDay[]>(`${base}/schedule`)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canSubmit = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('schedule.submit'))

const iso = (d: Date) => d.toISOString().slice(0, 10)
const tomorrow = iso(new Date(Date.now() + 86_400_000))
const date = ref(tomorrow)
const baseMw = ref(25)
const peakMw = ref(10)
const gasMwh = ref(160)
const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref(false)

const dates = computed(() => [...new Set((schedule.value ?? []).map(s => s.date))].sort().reverse())
const selected = ref(dates.value[0] ?? '')
const power = computed(() => schedule.value?.find(s => s.date === selected.value && s.commodity === 'villany'))
const gas = computed(() => schedule.value?.find(s => s.date === selected.value && s.commodity === 'gaz'))
const chart = computed(() => (power.value?.values ?? []).map((v, h) => ({ label: String(h).padStart(2, '0'), value: v })))
const sum = (a?: number[]) => (a ?? []).reduce((x, y) => x + y, 0)
const nf = (n: number) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 1 }).format(n)
const tomorrowDone = computed(() => !!schedule.value?.some(s => s.date === tomorrow && s.commodity === 'villany'))
const statusLabel = { benyujtva: 'Benyújtva', elfogadva: 'Elfogadva' } as const

async function submit() {
  busy.value = true
  message.value = null
  try {
    await $fetch(`${base}/schedule`, { method: 'POST', body: { date: date.value, commodity: 'villany', baseMw: baseMw.value, peakMw: peakMw.value } })
    await $fetch(`${base}/schedule`, { method: 'POST', body: { date: date.value, commodity: 'gaz', dailyMwh: gasMwh.value } })
    message.value = { kind: 'ok', text: `A ${date.value} napi menetrend benyújtva` }
    await refresh()
    selected.value = date.value
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen benyújtás' }
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="card">
    <h2>Napi menetrend</h2>
    <p class="hint" data-testid="tomorrow-status">
      Holnapi ({{ tomorrow }}) villany-menetrend: <strong>{{ tomorrowDone ? 'benyújtva' : 'még hiányzik' }}</strong>
    </p>
    <div class="toolbar">
      <div>
        <label for="sd">Nap</label>
        <select id="sd" v-model="selected" data-testid="schedule-date">
          <option v-for="d in dates" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
      <p v-if="power" class="hint" data-testid="power-total">Villany: {{ nf(sum(power.values)) }} MWh · {{ statusLabel[power.status] }}</p>
      <p v-if="gas" class="hint" data-testid="gas-total">Gáz: {{ nf(sum(gas.values)) }} MWh/nap · {{ statusLabel[gas.status] }}</p>
    </div>
    <BarChart v-if="chart.length" :items="chart" unit="MW" title="Villany-menetrend órák szerint" testid="schedule-chart" />
  </section>

  <section v-if="canSubmit" class="card" data-testid="schedule-form">
    <h2>Menetrend benyújtása</h2>
    <form @submit.prevent="submit">
      <div class="toolbar">
        <div><label for="d">Nap (a következő 7 napra)</label><input id="d" v-model="date" type="date" data-testid="submit-date"></div>
        <div><label for="b">Villany alap (MW)</label><input id="b" v-model.number="baseMw" type="number" min="0" step="0.5" data-testid="base-mw"></div>
        <div><label for="p">Csúcsidei többlet (MW, 8–20 h hétköznap)</label><input id="p" v-model.number="peakMw" type="number" min="0" step="0.5" data-testid="peak-mw"></div>
        <div><label for="g">Gáz (MWh/nap)</label><input id="g" v-model.number="gasMwh" type="number" min="0" data-testid="gas-mwh"></div>
      </div>
      <button type="submit" :disabled="busy" data-testid="submit-schedule">Benyújtás</button>
    </form>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">{{ message.text }}</p>
  </section>

  <section class="card">
    <h2>Utolsó napok</h2>
    <table>
      <thead><tr><th>Nap</th><th>Villany (MWh)</th><th>Gáz (MWh)</th><th>Állapot</th></tr></thead>
      <tbody>
        <tr v-for="d in dates.slice(0, 10)" :key="d" :data-testid="`schedule-row-${d}`">
          <td>{{ d }}</td>
          <td>{{ nf(sum(schedule?.find(s => s.date === d && s.commodity === 'villany')?.values)) }}</td>
          <td>{{ nf(sum(schedule?.find(s => s.date === d && s.commodity === 'gaz')?.values)) }}</td>
          <td>{{ statusLabel[(schedule?.find(s => s.date === d && s.commodity === 'villany') ?? schedule?.find(s => s.date === d))?.status ?? 'benyujtva'] }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
