<script setup lang="ts">
definePageMeta({ layout: 'partner', middleware: 'auth' })
const pid = String(useRoute().params.pid)
interface Entry { at: string, userId: string, userName: string, action: string }
const { data: entries } = await useFetch<Entry[]>(`/api/partner/${encodeURIComponent(pid)}/audit`)
const q = ref('')
const rows = computed(() => (entries.value ?? []).filter(e => !q.value || `${e.userName} ${e.action}`.toLowerCase().includes(q.value.toLowerCase())))
const when = (iso: string) => new Date(iso).toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <section class="card">
    <h2>Auditnapló</h2>
    <p class="hint">Ki mit tett a cég adataival: belépés, jóváhagyások, javaslatok, fizetések. Csak a megfelelőségi és az adminisztrátori szerepkör látja.</p>
    <div class="toolbar">
      <div><label for="aq">Keresés</label><input id="aq" v-model="q" data-testid="audit-search" placeholder="név vagy művelet"></div>
      <p class="hint" data-testid="audit-count">{{ rows.length }} bejegyzés</p>
    </div>
    <table class="wrap">
      <thead><tr><th>Időpont</th><th>Felhasználó</th><th>Művelet</th></tr></thead>
      <tbody>
        <tr v-for="(e, i) in rows" :key="i" data-testid="audit-row">
          <td>{{ when(e.at) }}</td><td>{{ e.userName }}</td><td>{{ e.action }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
