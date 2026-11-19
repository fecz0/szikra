<script setup lang="ts">
import { roleLabel } from '../../server/domain/permissions'

definePageMeta({ middleware: 'auth' })
interface Me { user: { name: string }, companies: { id: string, name: string, role: keyof typeof roleLabel }[] }
const { data: me } = await useFetch<Me>('/api/auth/me', { key: 'me' })

// Egyetlen cég esetén nincs mit választani.
if (me.value?.companies.length === 1) await navigateTo(`/partner/${encodeURIComponent(me.value.companies[0]!.id)}`)
</script>

<template>
  <div class="page">
    <section class="card narrow" data-testid="company-select">
      <h1>Válasszon céget</h1>
      <p class="hint">Bejelentkezve: {{ me?.user.name }}</p>
      <ul class="list">
        <li v-for="c in me?.companies" :key="c.id">
          <NuxtLink class="tile" :to="`/partner/${encodeURIComponent(c.id)}`" :data-testid="`company-${c.id}`">
            <strong>{{ c.name }}</strong>
            <span class="chip">{{ roleLabel[c.role] }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>
