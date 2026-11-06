<script setup lang="ts">
import type { SapCustomer } from '../../../server/mock-sap/types'

const route = useRoute()
const id = route.params.id as string
const { data: customer, error, refresh } = await useFetch<SapCustomer>(`/api/account/${encodeURIComponent(id)}`)

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)

const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'
const statusLabel = { open: 'Nyitott', paid: 'Kiegyenlítve', overdue: 'Lejárt' } as const

// Nyitott és lejárt (nem kiegyenlített) számlák összege; a fizetés utáni
// refresh() hatására automatikusan újraszámolódik.
const debtTotal = computed(() =>
  (customer.value?.bills ?? [])
    .filter(b => b.status !== 'paid')
    .reduce((sum, b) => sum + b.amountHuf, 0),
)

async function pay(billId: string) {
  busy.value = billId
  message.value = null
  try {
    await $fetch(`/api/account/${encodeURIComponent(id)}/pay`, { method: 'POST', body: { billId } })
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
  <section v-if="error" class="card narrow" role="alert">
    <h1>Nem található ügyfél</h1>
    <NuxtLink to="/">Vissza a belépéshez</NuxtLink>
  </section>

  <div v-else-if="customer">
    <section class="card">
      <h1 data-testid="customer-name">{{ customer.name }}</h1>
      <p>{{ customer.address }} · Szerződéses számla: <code>{{ customer.contractAccount }}</code></p>
      <p>Fizetési mód: <strong data-testid="payment-method">{{ customer.paymentMethod.label }}</strong></p>
    </section>

    <section class="card">
      <h2>Mérőórák</h2>
      <ul class="meters">
        <li v-for="m in customer.meters" :key="m.id" :data-testid="`meter-${m.type}`">
          <strong>{{ m.type === 'villany' ? 'Villany' : 'Gáz' }}</strong>
          <span class="chip">{{ m.smart ? 'Okosmérő' : 'Hagyományos mérő' }}</span>
          <span>Utolsó állás: {{ m.lastReading }} {{ m.unit }}</span>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2>Számlák</h2>
      <p data-testid="debt-total">
        {{ debtTotal > 0 ? `Nyitott tartozás összesen: ${huf(debtTotal)}` : 'Nincs tartozás' }}
      </p>
      <p v-if="message" :class="['msg', message.kind]" :role="message.kind === 'err' ? 'alert' : 'status'">
        {{ message.text }}
      </p>
      <table>
        <thead>
          <tr><th>Időszak</th><th>Összeg</th><th>Esedékes</th><th>Állapot</th><th /></tr>
        </thead>
        <tbody>
          <tr v-for="b in customer.bills" :key="b.id" :data-testid="`bill-${b.id}`">
            <td>{{ b.period }}</td>
            <td>{{ huf(b.amountHuf) }}</td>
            <td>{{ b.dueDate }}</td>
            <td><span :class="['status', b.status]" data-testid="bill-status">{{ statusLabel[b.status] }}</span></td>
            <td>
              <button v-if="b.status !== 'paid'" :disabled="busy === b.id" @click="pay(b.id)">
                Fizetés
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
