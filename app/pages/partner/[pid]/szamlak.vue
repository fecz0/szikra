<script setup lang="ts">
import type { Invoice } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: invoices, refresh } = await useFetch<Invoice[]>(`${base}/invoices`)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canPay = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('invoices.pay'))

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'
const statusLabel = { open: 'Nyitott', paid: 'Kiegyenlítve', overdue: 'Lejárt' } as const

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
    <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">{{ message.text }}</p>
    <table>
      <thead><tr><th>Időszak</th><th>Összeg</th><th>Esedékes</th><th>Állapot</th><th /></tr></thead>
      <tbody>
        <tr v-for="i in invoices" :key="i.id" :data-testid="`invoice-${i.id}`">
          <td>{{ i.period }}</td>
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
