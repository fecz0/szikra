<script setup lang="ts">
import { caseTypes } from '../../../../../server/domain/case-types'
import type { CaseTypeId, Invoice, SupplyPoint } from '../../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const base = `/api/partner/${encodeURIComponent(pid)}`
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const caps = computed(() => me.value?.companies.find(c => c.id === pid)?.capabilities ?? [])

// csak azok az ügytípusok, amiket a szerepkör indíthat
const available = computed(() => Object.values(caseTypes).filter(t => caps.value.includes('cases.create') && caps.value.includes(t.capability)))
const type = ref<CaseTypeId | ''>('')
const def = computed(() => (type.value ? caseTypes[type.value] : null))

const invoices = caps.value.includes('invoices.view') ? (await useFetch<Invoice[]>(`${base}/invoices`)).data : ref<Invoice[]>([])
const points = caps.value.includes('supply.view') ? (await useFetch<SupplyPoint[]>(`${base}/supply-points`)).data : ref<SupplyPoint[]>([])

const values = reactive<Record<string, string>>({})
const error = ref('')
const huf = (n: number) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft'

async function submit() {
  error.value = ''
  try {
    const rec = await $fetch<{ id: string }>(`${base}/cases`, { method: 'POST', body: { type: type.value, fields: { ...values } } })
    await navigateTo(`/partner/${encodeURIComponent(pid)}/ugyek/${encodeURIComponent(rec.id)}`)
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Sikertelen beküldés'
  }
}
</script>

<template>
  <section class="card narrow">
    <h1>Új ügy indítása</h1>
    <form @submit.prevent="submit">
      <label for="type">Ügytípus</label>
      <select id="type" v-model="type" data-testid="case-type">
        <option value="" disabled>Válasszon…</option>
        <option v-for="t in available" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <p v-if="def" class="hint">{{ def.hint }}</p>

      <template v-if="def">
        <div v-for="f in def.fields" :key="f.key">
          <label :for="`f-${f.key}`">{{ f.label }}</label>
          <select v-if="f.kind === 'invoice'" :id="`f-${f.key}`" v-model="values[f.key]" :data-testid="`field-${f.key}`">
            <option v-for="i in invoices" :key="i.id" :value="i.id">{{ i.period }} · {{ huf(i.amountHuf) }}</option>
          </select>
          <select v-else-if="f.kind === 'supply'" :id="`f-${f.key}`" v-model="values[f.key]" :data-testid="`field-${f.key}`">
            <option v-for="s in points" :key="s.id" :value="s.id">{{ s.type === 'villany' ? 'Villany' : 'Gáz' }} · {{ s.pod }}</option>
          </select>
          <textarea v-else-if="f.kind === 'textarea'" :id="`f-${f.key}`" v-model="values[f.key]" rows="3" :data-testid="`field-${f.key}`" />
          <input v-else :id="`f-${f.key}`" v-model="values[f.key]" :type="f.kind === 'number' ? 'number' : 'text'" :data-testid="`field-${f.key}`">
        </div>
        <button type="submit" data-testid="submit-case">Beküldés</button>
      </template>
      <p v-if="error" class="msg err" role="alert">{{ error }}</p>
    </form>
  </section>
</template>
