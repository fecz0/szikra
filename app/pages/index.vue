<script setup lang="ts">
const customerId = ref('')
const showDemo = useRuntimeConfig().public.demoUsers
const demoUsers = [
  { id: 'DEMO-OKOS', name: 'Teszt Elek', note: 'okosmérő, villany + gáz, nyitott számlák' },
  { id: 'DEMO-ELMARADT', name: 'Késő Kata', note: 'lejárt számlák' },
  { id: 'DEMO-KARTYA', name: 'Pech Péter', note: 'a kártyaterhelés elutasításra kerül' },
  { id: 'DEMO-RENDEZETT', name: 'Rendes Réka', note: 'minden számla kiegyenlítve' },
]
async function login() {
  const id = customerId.value.trim()
  if (id) await navigateTo(`/fiok/${encodeURIComponent(id)}`)
}
</script>

<template>
  <section class="card narrow">
    <h1>Ügyfélportál</h1>
    <p>Add meg az ügyfélazonosítódat a belépéshez.</p>
    <form @submit.prevent="login">
      <label for="cid">Ügyfélazonosító</label>
      <input id="cid" v-model="customerId" autocomplete="off" placeholder="pl. T1A2B3C4D">
      <button type="submit">Belépés</button>
    </form>
  </section>

  <section v-if="showDemo" class="card narrow" data-testid="demo-users">
    <h2>Demó ügyfelek</h2>
    <p class="hint">Kitalált adatok, kattints bármelyikre. A fizetések fél óránként visszaállnak.</p>
    <ul class="demo">
      <li v-for="u in demoUsers" :key="u.id">
        <NuxtLink :to="`/fiok/${u.id}`"><strong>{{ u.name }}</strong></NuxtLink>
        <code>{{ u.id }}</code>
        <span class="hint">{{ u.note }}</span>
      </li>
    </ul>
  </section>
</template>
