<script setup lang="ts">
import { caseTypes, statusLabel } from '../../../../../server/domain/case-types'
import type { CaseRecord } from '../../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const { data: cases } = await useFetch<CaseRecord[]>(`/api/partner/${encodeURIComponent(pid)}/cases`)
const { data: me } = await useFetch<{ companies: { id: string, capabilities: string[] }[] }>('/api/auth/me', { key: 'me' })
const canCreate = computed(() => !!me.value?.companies.find(c => c.id === pid)?.capabilities.includes('cases.create'))
</script>

<template>
  <section class="card">
    <h2>Ügyeim</h2>
    <NuxtLink v-if="canCreate" :to="`/partner/${pid}/ugyek/uj`" data-testid="new-case">Új ügy indítása</NuxtLink>
    <p v-if="!cases?.length" class="hint">Még nincs ügye.</p>
    <table v-else>
      <thead><tr><th>Azonosító</th><th>Típus</th><th>Indítva</th><th>Állapot</th></tr></thead>
      <tbody>
        <tr v-for="c in cases" :key="c.id" :data-testid="`case-${c.id}`">
          <td><NuxtLink :to="`/partner/${pid}/ugyek/${encodeURIComponent(c.id)}`">{{ c.id }}</NuxtLink></td>
          <td>{{ caseTypes[c.type].label }}</td>
          <td>{{ new Date(c.createdAt).toLocaleDateString('hu-HU') }}</td>
          <td data-testid="case-status">{{ statusLabel[c.status] }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
