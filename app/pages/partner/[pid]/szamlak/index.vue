<script setup lang="ts">
import type { Invoice } from '../../../../../server/domain/types'

type Row = Invoice & { siteLabel?: string, energy?: 'villany' | 'gaz' }
definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: invoices, refresh } = await useFetch<Row[]>(`${base}/invoices`)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canPay = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('invoices.pay'))

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
const status = ref<'' | Invoice['status']>('')
const site = ref('')
const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'
const statusLabel = { open: 'Nyitott', paid: 'Kiegyenlítve', overdue: 'Lejárt' } as const

const sites = computed(() => [...new Map((invoices.value ?? []).filter(i => i.supplyPointId).map(i => [i.supplyPointId!, i.siteLabel ?? i.supplyPointId!])).entries()])
const rows = computed(() => (invoices.value ?? [])
  .filter(i => (!status.value || i.status === status.value) && (!site.value || i.supplyPointId === site.value))
  .sort((a, b) => b.issueDate.localeCompare(a.issueDate)))
const outstanding = computed(() => rows.value.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amountHuf, 0))

async function pay(id: string) {
  busy.value = id
  message.value = null
  try {
    await $fetch(`${base}/invoices/${encodeURIComponent(id)}/pay`, { method: 'POST' })
    message.value = { kind: 'ok', text: 'Sikeres fizetés' }
    await refresh()
  }
  catch (e: any) {
    message.value = { kind: 'err', text: e?.data?.message ?? 'Sikertelen fizetés' }
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <section class="card">
    <h2>Számlák</h2>
    <div class="toolbar">
      <div>
        <label for="fs">Állapot</label>
        <select id="fs" v-model="status" data-testid="filter-status">
          <option value="">Mind</option>
          <option value="open">Nyitott</option>
          <option value="overdue">Lejárt</option>
          <option value="paid">Kiegyenlítve</option>
        </select>
      </div>
      <div v-if="sites.length > 1">
        <label for="fp">Hely</label>
        <select id="fp" v-model="site" data-testid="filter-supply">
          <option value="">Mind</option>
          <option v-for="[id, label] in sites" :key="id" :value="id">{{ label }}</option>
        </select>
      </div>
      <p class="hint" data-testid="invoice-summary">{{ rows.length }} számla · nem kiegyenlített: {{ huf(outstanding) }}</p>
    </div>
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">{{ message.text }}</p>
    <table>
      <thead><tr><th>Időszak</th><th v-if="sites.length > 1">Hely</th><th>Összeg</th><th>Esedékes</th><th>Állapot</th><th /></tr></thead>
      <tbody>
        <tr v-for="i in rows" :key="i.id" :data-testid="`invoice-${i.id}`">
          <td><NuxtLink :to="`/partner/${pid}/szamlak/${encodeURIComponent(i.id)}`" :data-testid="`open-${i.id}`">{{ i.period }}</NuxtLink></td>
          <td v-if="sites.length > 1">{{ i.siteLabel }}<span v-if="i.supplyPointId" class="hint"> · {{ i.energy === 'gaz' ? 'gáz' : 'villany' }}</span></td>
          <td>{{ huf(i.amountHuf) }}</td>
          <td>{{ i.dueDate }}</td>
          <td><span :class="['status', i.status]" data-testid="invoice-status">{{ statusLabel[i.status] }}</span></td>
          <td>
            <button v-if="i.status !== 'paid' && canPay" :disabled="busy === i.id" data-testid="pay" @click="pay(i.id)">Fizetés</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
