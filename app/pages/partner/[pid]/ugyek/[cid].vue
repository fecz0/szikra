<script setup lang="ts">
import { caseTypes, statusLabel } from '../../../../../server/domain/case-types'
import type { CaseRecord } from '../../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const route = useRoute()
const pid = String(route.params.pid)
const cid = String(route.params.cid)
const base = `/api/partner/${encodeURIComponent(pid)}/cases/${encodeURIComponent(cid)}`
const { data: rec, error, refresh } = await useFetch<CaseRecord>(base)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canWrite = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('cases.create'))

const text = ref('')
async function send() {
  if (!text.value.trim()) return
  await $fetch(`${base}/messages`, { method: 'POST', body: { text: text.value } })
  text.value = ''
  await refresh()
}
</script>

<template>
  <section v-if="error" class="card narrow" role="alert"><h1>Az ügy nem található</h1></section>
  <section v-else-if="rec" class="card" data-testid="case-detail">
    <h1>{{ caseTypes[rec.type].label }} <code>{{ rec.id }}</code></h1>
    <p>Állapot: <strong data-testid="case-status">{{ statusLabel[rec.status] }}</strong> · indította: {{ rec.createdBy }}</p>
    <ul class="list">
      <li v-for="f in caseTypes[rec.type].fields" :key="f.key">{{ f.label }}: <strong>{{ rec.fields[f.key] || '–' }}</strong></li>
    </ul>
    <h2>Üzenetek</h2>
    <ul class="msgs">
      <li v-for="m in rec.messages" :key="m.at">{{ m.by }}: {{ m.text }}</li>
    </ul>
    <form v-if="canWrite" @submit.prevent="send">
      <label for="msg">Új üzenet</label>
      <textarea id="msg" v-model="text" rows="2" data-testid="message-text" />
      <button type="submit" data-testid="send-message">Küldés</button>
    </form>
  </section>
</template>
