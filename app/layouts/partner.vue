<script setup lang="ts">
import { roleLabel } from '../../server/domain/permissions'

interface Me {
  user: { id: string, name: string }
  companies: { id: string, name: string, kind: 'fogyaszto' | 'termelo' | 'kereskedo', role: keyof typeof roleLabel, capabilities: string[] }[]
}
const route = useRoute()
const pid = computed(() => String(route.params.pid ?? ''))
const { data: me } = await useFetch<Me>('/api/auth/me', { key: 'me' })
const company = computed(() => me.value?.companies.find(c => c.id === pid.value))
const has = (c: string) => !!company.value?.capabilities.includes(c)
const producer = computed(() => company.value?.kind === 'termelo')
const trader = computed(() => company.value?.kind === 'kereskedo')

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/')
}
</script>

<template>
  <div class="page">
    <section v-if="company" class="card company-bar" data-testid="company-bar">
      <div>
        <h1 data-testid="company-name">{{ company.name }}</h1>
        <p class="hint">
          {{ me?.user.name }} ·
          <span class="chip" data-testid="role-chip">{{ roleLabel[company.role] }}</span>
          <NuxtLink v-if="(me?.companies.length ?? 0) > 1" to="/valasztas" data-testid="switch-company"> · Cégváltás</NuxtLink>
        </p>
      </div>
      <button class="ghost" data-testid="logout" @click="logout">Kijelentkezés</button>
    </section>

    <nav v-if="company" class="subnav" aria-label="Partnerportál menü">
      <NuxtLink :to="`/partner/${pid}`" exact-active-class="on">Áttekintés</NuxtLink>
      <NuxtLink v-if="has('invoices.view') && !producer" :to="`/partner/${pid}/szamlak`" active-class="on">Számlák</NuxtLink>
      <NuxtLink v-if="has('production.view') && producer" :to="`/partner/${pid}/termeles`" active-class="on">Termelés és elszámolás</NuxtLink>
      <NuxtLink v-if="has('deals.view') && trader" :to="`/partner/${pid}/ugyletek`" active-class="on">Ügyletek</NuxtLink>
      <NuxtLink v-if="has('schedule.view') && trader" :to="`/partner/${pid}/menetrend`" active-class="on">Menetrend</NuxtLink>
      <NuxtLink v-if="has('supply.view') && !trader" :to="`/partner/${pid}/fogyasztasi-helyek`" active-class="on">{{ producer ? 'Termelőhelyek' : 'Fogyasztási helyek' }}</NuxtLink>
      <NuxtLink :to="`/partner/${pid}/ugyek`" active-class="on">Ügyeim</NuxtLink>
    </nav>

    <section v-if="!company" class="card narrow" role="alert">
      <h1>Ehhez a céghez nincs hozzáférése</h1>
      <NuxtLink to="/valasztas">Vissza a cégválasztáshoz</NuxtLink>
    </section>
    <slot v-else />
  </div>
</template>
