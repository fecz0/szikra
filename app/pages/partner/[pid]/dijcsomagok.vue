<script setup lang="ts">
import type { TariffDef } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`

interface Result { tariff: { id: string, name: string, kind: TariffDef['kind'], kindLabel: string, system: boolean, monthlyFeeHuf: number }, annualHuf: number, avgHufPerKwh: number, months: { month: string, energyHuf: number }[], isCurrent: boolean, savingVsCurrentHuf: number | null }
interface Sim { available: boolean, supplyPoint: { id: string, label?: string, tariff?: string }, kwh?: number, results: Result[], reconciliation?: { currentAnnualHuf: number, billedEnergyHuf: number, diffHuf: number, invoices: number } | null, dynamicWeighting?: { weightedHufPerKwh: number, monthAvgHufPerKwh: number } }

const { data: sites } = await useFetch<{ id: string, label: string, tariff: string | null, hasIntervals: boolean }[]>(`${base}/tariff-sites`, { default: () => [] })
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canManage = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('tariffs.manage'))
const canCase = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('contracts.manage'))

const selected = ref(sites.value?.find(s => s.hasIntervals)?.id ?? sites.value?.[0]?.id ?? '')
const { data: sim, refresh: refreshSim } = await useFetch<Sim | null>(() => `${base}/tariff-simulation?supplyPointId=${encodeURIComponent(selected.value)}`, { default: () => null, watch: [selected] })

const nf = (n: number, d = 0) => new Intl.NumberFormat('hu-HU', { maximumFractionDigits: d }).format(n)
const huf = (n: number) => `${nf(n)} Ft`
const mHuf = (n: number) => `${nf(n / 1e6, 2)} M Ft`
const best = computed(() => [...(sim.value?.results ?? [])].sort((a, b) => a.annualHuf - b.annualHuf)[0])
const chartItems = computed(() => (sim.value?.results ?? []).map(r => ({ label: r.tariff.name.length > 14 ? `${r.tariff.name.slice(0, 13)}…` : r.tariff.name, value: Math.round(r.annualHuf / 1000) / 1000 })))
const sel = ref('')
const monthly = computed(() => (sim.value?.results.find(r => r.tariff.id === sel.value) ?? sim.value?.results.find(r => r.isCurrent))?.months.map(m => ({ label: shortMonth(m.month), value: Math.round(m.energyHuf / 1000) / 1000 })) ?? [])

// díjcsomag-szerkesztő
const form = reactive({ name: '', kind: 'fix' as TariffDef['kind'], fix: 38, margin: 3, nappali: 41, csucs: 52, volgy: 31, fee: '' as string | number })
const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
async function create() {
  message.value = null
  const body: Record<string, unknown> = { name: form.name, kind: form.kind, monthlyFeeHuf: form.fee }
  if (form.kind === 'fix') body.fixHufPerKwh = form.fix
  if (form.kind === 'indexed' || form.kind === 'dynamic') body.marginHufPerKwh = form.margin
  if (form.kind === 'tou') body.zoneHufPerKwh = { nappali: form.nappali, csucs: form.csucs, volgy: form.volgy }
  try {
    await $fetch(`${base}/tariffs`, { method: 'POST', body })
    message.value = { kind: 'ok', text: `A(z) „${form.name}” díjcsomag létrehozva, a szimuláció már tartalmazza` }
    form.name = ''
    await refreshSim()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen mentés' }
  }
}
const switchLink = (r: Result) => `/partner/${pid}/ugyek/uj?type=dijcsomag&supply=${encodeURIComponent(selected.value)}&tariff=${encodeURIComponent(r.tariff.name)}`
</script>

<template>
  <section class="card">
    <h2>Díjcsomag-szimulátor</h2>
    <p class="hint">Mennyibe került volna az elmúlt 12 hónap energiadíja más díjcsomaggal? A számítás a telephely óránkénti mérőadatából készül; a rendszerhasználati díj, a pénzeszközök és az adók díjcsomagtól függetlenek, ezért itt nem szerepelnek.</p>
    <div v-if="!sites.length" class="hint" data-testid="no-sites">Ehhez a céghez nincs villany-fogyasztási hely.</div>
    <div v-else class="toolbar">
      <div>
        <label for="s">Fogyasztási hely</label>
        <select id="s" v-model="selected" data-testid="sim-site"><option v-for="s in sites" :key="s.id" :value="s.id">{{ s.label }} · {{ s.tariff }}</option></select>
      </div>
    </div>
    <p v-if="sim && !sim.available" class="hint" data-testid="no-intervals">Ehhez a helyhez nincs intervallum-mérőadat.</p>
  </section>

  <template v-if="sim?.available">
    <div class="tiles">
      <div class="tile" data-testid="tile-kwh"><h3>12 havi fogyasztás</h3><strong>{{ nf((sim.kwh ?? 0) / 1000) }} MWh</strong></div>
      <div v-if="best" class="tile" data-testid="tile-best">
        <h3>Legolcsóbb díjcsomag</h3><strong>{{ best.tariff.name }}</strong>
        <p v-if="best.savingVsCurrentHuf !== null && !best.isCurrent">Éves megtakarítás: <span class="status paid" data-testid="best-saving">{{ huf(best.savingVsCurrentHuf) }}</span></p>
        <p v-else>Ez a jelenlegi díjcsomag.</p>
      </div>
      <div v-if="sim.reconciliation" class="tile" data-testid="tile-reconcile">
        <h3>Motor-ellenőrzés</h3>
        <strong data-testid="reconcile-diff">{{ huf(sim.reconciliation.diffHuf) }}</strong>
        <p>eltérés a kiszámlázott energiadíjtól ({{ sim.reconciliation.invoices }} számla)</p>
      </div>
    </div>

    <section class="card" data-testid="sim-results">
      <h2>Összehasonlítás (éves energiadíj)</h2>
      <table class="wrap">
        <thead><tr><th>Díjcsomag</th><th>Típus</th><th>Éves energiadíj</th><th>Átlagár (Ft/kWh)</th><th>Különbség a jelenlegihez</th><th /></tr></thead>
        <tbody>
          <tr v-for="r in sim.results" :key="r.tariff.id" :data-testid="`sim-${r.tariff.id}`" @click="sel = r.tariff.id">
            <td>
              <strong>{{ r.tariff.name }}</strong>
              <span v-if="r.isCurrent" class="tag" data-testid="current-badge">jelenlegi</span>
              <span v-if="!r.tariff.system" class="tag">egyedi</span>
            </td>
            <td>{{ r.tariff.kindLabel }}</td>
            <td data-testid="sim-annual">{{ mHuf(r.annualHuf) }}</td>
            <td>{{ nf(r.avgHufPerKwh, 2) }}</td>
            <td>
              <span v-if="r.isCurrent" class="hint">–</span>
              <span v-else-if="r.savingVsCurrentHuf !== null" :class="['status', r.savingVsCurrentHuf > 0 ? 'paid' : 'overdue']" data-testid="sim-saving">{{ r.savingVsCurrentHuf > 0 ? '−' : '+' }}{{ huf(Math.abs(r.savingVsCurrentHuf)) }}/év</span>
            </td>
            <td><NuxtLink v-if="canCase && !r.isCurrent" :to="switchLink(r)" data-testid="switch-link">Váltás kérése</NuxtLink></td>
          </tr>
        </tbody>
      </table>
      <BarChart :items="chartItems" unit="M Ft / év" title="Éves energiadíj díjcsomagonként" testid="sim-chart" />
      <p v-if="sim.dynamicWeighting" class="hint" data-testid="dynamic-note">
        Dinamikus árazásnál a fogyasztással súlyozott átlagár ({{ nf(sim.dynamicWeighting.weightedHufPerKwh, 2) }} Ft/kWh) {{ sim.dynamicWeighting.weightedHufPerKwh > sim.dynamicWeighting.monthAvgHufPerKwh ? 'magasabb' : 'alacsonyabb' }}, mint a havi tőzsdei átlag ({{ nf(sim.dynamicWeighting.monthAvgHufPerKwh, 2) }} Ft/kWh): a telephely a drágább órákban fogyaszt többet, ezért a dinamikus díjcsomag nem mindig éri meg.
      </p>
    </section>

    <section class="card">
      <BarChart v-if="monthly.length" :items="monthly" unit="M Ft" :title="`Havi energiadíj: ${(sim.results.find(r => r.tariff.id === sel) ?? sim.results.find(r => r.isCurrent))?.tariff.name ?? ''}`" testid="sim-monthly" />
      <p class="hint">Kattintson egy sorra a havi bontáshoz.</p>
    </section>
  </template>

  <section v-if="canManage" class="card" data-testid="tariff-builder">
    <h2>Új díjcsomag (kód nélkül)</h2>
    <form @submit.prevent="create">
      <div class="toolbar">
        <div><label for="n">Név</label><input id="n" v-model="form.name" maxlength="60" data-testid="tariff-name"></div>
        <div><label for="k">Típus</label>
          <select id="k" v-model="form.kind" data-testid="tariff-kind">
            <option value="fix">Fix ár</option><option value="indexed">Tőzsdei havi átlag + díj</option>
            <option value="tou">Csúcs-völgy (zónás)</option><option value="dynamic">Dinamikus (óránkénti tőzsdei ár)</option>
          </select></div>
        <div v-if="form.kind === 'fix'"><label for="f">Ár (Ft/kWh)</label><input id="f" v-model.number="form.fix" type="number" step="0.01" data-testid="tariff-fix"></div>
        <div v-if="form.kind === 'indexed' || form.kind === 'dynamic'"><label for="m">Kereskedői díj (Ft/kWh)</label><input id="m" v-model.number="form.margin" type="number" step="0.01" data-testid="tariff-margin"></div>
        <template v-if="form.kind === 'tou'">
          <div><label for="z1">Nappali (Ft/kWh)</label><input id="z1" v-model.number="form.nappali" type="number" step="0.01" data-testid="tariff-nappali"></div>
          <div><label for="z2">Csúcs (Ft/kWh)</label><input id="z2" v-model.number="form.csucs" type="number" step="0.01" data-testid="tariff-csucs"></div>
          <div><label for="z3">Völgy (Ft/kWh)</label><input id="z3" v-model.number="form.volgy" type="number" step="0.01" data-testid="tariff-volgy"></div>
        </template>
        <div><label for="e">Havi díj (Ft, opcionális)</label><input id="e" v-model="form.fee" type="number" min="0" data-testid="tariff-fee"></div>
      </div>
      <button type="submit" data-testid="tariff-save">Díjcsomag mentése</button>
    </form>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'" data-testid="tariff-message">{{ message.text }}</p>
  </section>
</template>
