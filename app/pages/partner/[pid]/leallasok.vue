<script setup lang="ts">
import { REQUIRED_APPROVALS } from '../../../../server/domain/approvals'
import type { Outage, SupplyPoint } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: outages, refresh } = await useFetch<Outage[]>(`${base}/outages`)
const { data: points } = await useFetch<SupplyPoint[]>(`${base}/supply-points`, { default: () => [] })
const { data: me } = await useFetch<{ user: { id: string }, companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const caps = computed(() => me.value?.companies.find(c => c.id === pid)?.capabilities ?? [])
const canApprove = computed(() => caps.value.includes('outages.approve'))
const canPropose = computed(() => caps.value.includes('outages.propose'))

const today = new Date().toISOString().slice(0, 10)
const from = `${today.slice(0, 7)}-01`
const to = `${Number(today.slice(0, 4)) + 1}-12-31`
const rows = computed(() => (points.value ?? []).map(p => ({ id: p.id, label: p.label ?? p.id })))
const label = (id: string) => points.value?.find(p => p.id === id)?.label ?? id
const days = (o: Outage) => Math.round((Date.parse(o.to) - Date.parse(o.from)) / 86_400_000) + 1
const kindLabel = { tervezett: 'Tervezett', rendkivuli: 'Rendkívüli' } as const
const statusLabel = { 'jovahagyasra-var': 'Jóváhagyásra vár', 'jovahagyva': 'Jóváhagyva' } as const
const mine = (o: Outage) => me.value?.user.id
const canApproveThis = (o: Outage) => canApprove.value && o.status === 'jovahagyasra-var' && !o.approvals.some(a => a.userId === mine(o)) && o.proposedBy.userId !== mine(o)
const why = (o: Outage) => (o.proposedBy.userId === mine(o) ? 'A saját javaslatát nem hagyhatja jóvá' : o.approvals.some(a => a.userId === mine(o)) ? 'Ezt már jóváhagyta' : '')

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
async function approve(id: string) {
  busy.value = id
  message.value = null
  try {
    const rec = await $fetch<Outage>(`${base}/outages/${encodeURIComponent(id)}/approve`, { method: 'POST' })
    message.value = { kind: 'ok', text: rec.status === 'jovahagyva' ? 'A leállás jóváhagyva (2/2)' : `Jóváhagyva (${rec.approvals.length}/${REQUIRED_APPROVALS}), még egy különböző jóváhagyó kell` }
    await refresh()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen jóváhagyás' }
  }
  finally {
    busy.value = null
  }
}

const form = reactive({ supplyPointId: points.value?.[0]?.id ?? '', kind: 'tervezett', from: '', to: '', purpose: '' })
async function propose() {
  message.value = null
  try {
    await $fetch(`${base}/outages`, { method: 'POST', body: { ...form } })
    message.value = { kind: 'ok', text: 'A javaslat rögzítve, jóváhagyásra vár (két különböző jóváhagyó kell)' }
    form.from = ''; form.to = ''; form.purpose = ''
    await refresh()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen javaslat' }
  }
}
</script>

<template>
  <section class="card">
    <OutageTimeline :rows="rows" :outages="outages ?? []" :from="from" :to="to" :today="today" />
    <p class="hint">Négy szem elve: a leállás csak két <strong>különböző</strong> jóváhagyó elfogadása után lép életbe; a javaslattevő a saját javaslatát nem hagyhatja jóvá.</p>
  </section>

  <section class="card">
    <h2>Leállások</h2>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'" data-testid="outage-message">{{ message.text }}</p>
    <table class="wrap">
      <thead><tr><th>Blokk</th><th>Típus</th><th>Időszak</th><th>Nap</th><th>Cél</th><th>Javasolta</th><th>Jóváhagyás</th><th>Állapot</th><th /></tr></thead>
      <tbody>
        <tr v-for="o in outages" :key="o.id" :data-testid="`outage-${o.id}`">
          <td>{{ label(o.supplyPointId) }}</td>
          <td>{{ kindLabel[o.kind] }}</td>
          <td>{{ o.from }} – {{ o.to }}</td>
          <td>{{ days(o) }}</td>
          <td>{{ o.purpose }}</td>
          <td>{{ o.proposedBy.name }}</td>
          <td>
            <span data-testid="approval-count">{{ o.approvals.length }}/{{ REQUIRED_APPROVALS }}</span>
            <span class="approvals"><span v-for="a in o.approvals" :key="a.userId" class="tag">{{ a.name }}</span></span>
          </td>
          <td><span :class="['status', o.status]" data-testid="outage-status">{{ statusLabel[o.status] }}</span></td>
          <td>
            <button v-if="canApproveThis(o)" :disabled="busy === o.id" data-testid="approve-outage" @click="approve(o.id)">Jóváhagyás</button>
            <span v-else-if="canApprove && o.status === 'jovahagyasra-var'" class="hint" data-testid="approve-blocked">{{ why(o) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>

  <section v-if="canPropose" class="card" data-testid="propose-form">
    <h2>Leállás javaslata</h2>
    <form @submit.prevent="propose">
      <div class="toolbar">
        <div><label for="lb">Blokk</label>
          <select id="lb" v-model="form.supplyPointId" data-testid="outage-block"><option v-for="r in rows" :key="r.id" :value="r.id">{{ r.label }}</option></select></div>
        <div><label for="lk">Típus</label>
          <select id="lk" v-model="form.kind" data-testid="outage-kind"><option value="tervezett">Tervezett</option><option value="rendkivuli">Rendkívüli</option></select></div>
        <div><label for="lf">Kezdete</label><input id="lf" v-model="form.from" type="date" data-testid="outage-from"></div>
        <div><label for="lt">Vége</label><input id="lt" v-model="form.to" type="date" data-testid="outage-to"></div>
      </div>
      <label for="lp">Cél</label>
      <input id="lp" v-model="form.purpose" maxlength="300" data-testid="outage-purpose" placeholder="pl. Üzemanyagcsere és időszakos karbantartás">
      <button type="submit" data-testid="propose-outage">Javaslat beküldése</button>
    </form>
  </section>
</template>
