<script setup lang="ts">
import type { SupplyPoint } from '../../../../server/domain/types'

definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
const { data: points } = await useFetch<SupplyPoint[]>(`/api/partner/${encodeURIComponent(pid)}/supply-points`)
</script>

<template>
  <section class="card">
    <h2>Fogyasztási helyek</h2>
    <ul class="list">
      <li v-for="s in points" :key="s.id" :data-testid="`supply-${s.type}`">
        <strong>{{ s.type === 'villany' ? 'Villany' : 'Gáz' }}</strong>
        <span class="chip">{{ s.smart ? 'Okosmérő' : 'Hagyományos mérő' }}</span>
        <code>{{ s.pod }}</code>
        <span>{{ s.address }}</span>
        <span>Utolsó állás: {{ s.lastReading }} {{ s.unit }} ({{ s.lastReadingDate }})</span>
      </li>
    </ul>
  </section>
</template>
