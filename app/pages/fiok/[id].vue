<script setup lang="ts">
import type { SapCustomer } from '../../../server/mock-sap/types'

const route = useRoute()
const id = route.params.id as string
const { data: customer, error, refresh } = await useFetch<SapCustomer>(`/api/account/${encodeURIComponent(id)}`)

const message = ref<{ kind: 'ok' | 'err', text: string } | null>(null)
const busy = ref<string | null>(null)
const acceptingTerms = ref(false)
const termsError = ref('')

const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'
const statusLabel = { open: 'Nyitott', paid: 'Kiegyenlítve', overdue: 'Lejárt' } as const

// Amíg a felhasználó nem fogadta el az aktuális ÁSZF-et, a fiókoldal blokkolt.
const termsOutdated = computed(() => {
  const terms = customer.value?.terms
  return !!terms && terms.acceptedVersion !== terms.current.id
})

async function acceptTerms() {
  acceptingTerms.value = true
  termsError.value = ''
  try {
    await $fetch(`/api/account/${encodeURIComponent(id)}/terms`, { method: 'POST' })
    await refresh()
  }
  catch (e: any) {
    termsError.value = e?.data?.message ?? 'Az ÁSZF elfogadása nem sikerült.'
  }
  finally {
    acceptingTerms.value = false
  }
}

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
  <div class="page">
  <section v-if="error" class="card narrow" role="alert">
    <h1>Nem található ügyfél</h1>
    <NuxtLink to="/">Vissza a belépéshez</NuxtLink>
  </section>

  <template v-else-if="customer">
  <div data-testid="account-content" :inert="termsOutdated" :aria-hidden="termsOutdated ? 'true' : undefined">
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

  <div
    v-if="termsOutdated"
    class="modal-overlay"
    data-testid="terms-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="terms-title"
  >
    <div class="modal">
      <h2 id="terms-title">Megváltoztak a felhasználási feltételek</h2>
      <p>
        Az ÁSZF új verziója jelent meg. A fiókja használatához el kell fogadnia a módosításokat.
      </p>
      <p data-testid="terms-version">
        Aktuális verzió: <strong>{{ customer.terms.current.id }}</strong> ({{ customer.terms.current.date }})
      </p>
      <p v-if="termsError" class="msg err" role="alert">{{ termsError }}</p>
      <button type="button" data-testid="terms-accept" :disabled="acceptingTerms" @click="acceptTerms">
        Elfogadom
      </button>
    </div>
  </div>
  </template>
  </div>
</template>
