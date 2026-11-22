<script setup lang="ts">
interface DemoUser { id: string, name: string, note: string, companies: { name: string, role: string }[] }
const showDemo = useRuntimeConfig().public.demoUsers
const { data: demoUsers } = showDemo ? await useFetch<DemoUser[]>('/api/auth/demo-users') : { data: ref<DemoUser[]>([]) }

import { roleLabel } from '../../server/domain/permissions'

const userId = ref('')
const error = ref('')

async function login(id: string) {
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { userId: id } })
    await navigateTo('/valasztas')
  }
  catch (e: any) {
    error.value = e?.data?.message ?? 'Sikertelen belépés'
  }
}
</script>

<template>
  <section class="hero" data-testid="hero">
    <div class="hero-in">
      <div class="hero-text">
        <aside class="notice" data-testid="demo-notice">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
          </svg>
          <div>
            <strong>Demó tájékoztató</strong>
            <p>Ez a Szikra bemutató környezete. Minden adat kitalált, a módosítások fél óránként visszaállnak.</p>
          </div>
        </aside>
        <h1>Szikra partnerportál</h1>
        <p class="lead">
          Üzleti partnereinknek: számlák és fizetés, fogyasztási helyek, mérőállás-közlés,
          ajánlatkérés és ügyintézés egy helyen, cégenként és szerepkörönként szabályozott hozzáféréssel.
        </p>
        <form class="login" @submit.prevent="userId.trim() && login(userId.trim())">
          <label for="uid">Felhasználói azonosító</label>
          <input id="uid" v-model="userId" autocomplete="off" placeholder="pl. DEMO-ADMIN">
          <button type="submit">Belépés</button>
          <p v-if="error" class="msg err" role="alert">{{ error }}</p>
        </form>
      </div>
      <div class="hero-art" aria-hidden="true">
        <svg viewBox="0 0 420 400" focusable="false">
          <circle cx="215" cy="200" r="190" fill="#d1d5db" />
          <circle cx="225" cy="200" r="168" fill="#00567e" />
          <circle cx="225" cy="200" r="168" fill="url(#g)" />
          <rect x="10" y="118" width="190" height="26" rx="13" fill="#d1d5db" />
          <circle cx="30" cy="131" r="13" fill="#e5e7eb" />
          <rect x="60" y="176" width="150" height="26" rx="13" fill="#d1d5db" />
          <path d="M225 95l17 62 62 17-62 17-17 62-17-62-62-17 62-17z" fill="#f0b323" />
          <path d="M310 285l7 24 24 7-24 7-7 24-7-24-24-7 24-7z" fill="#fff" opacity=".85" />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1c2b39" />
              <stop offset="1" stop-color="#00567e" stop-opacity=".2" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </section>

  <section v-if="showDemo" id="demo" class="band" data-testid="demo-users">
    <div class="band-in">
      <h2>Demó felhasználók</h2>
      <p class="hint">Kitalált adatok. A szerepkör dönti el, mit lát és mit indíthat a felhasználó.</p>
      <ul class="demo">
        <li v-for="u in demoUsers" :key="u.id" class="tile" :data-testid="`demo-user-${u.id}`">
          <strong>{{ u.name }}</strong>
          <code>{{ u.id }}</code>
          <span class="hint">{{ u.note }}</span>
          <span class="chips"><span v-for="c in u.companies" :key="c.name" class="tag">{{ c.name }} · {{ (roleLabel as Record<string, string>)[c.role] ?? c.role }}</span></span>
          <button type="button" :data-testid="`login-${u.id}`" @click="login(u.id)">Belépés mint {{ u.name }}</button>
        </li>
      </ul>
    </div>
  </section>

  <section class="band alt">
    <div class="band-in">
      <h2>Amit a portál tud</h2>
      <ul class="features">
        <li class="tile"><h3>Több cég, szerepkörök</h3><p>Egy belépéssel több cég kezelése, cégenként külön jogosultsággal.</p></li>
        <li class="tile"><h3>Számlák és fizetés</h3><p>Számlalista, egyenleg, online fizetés a bank visszajelzésével.</p></li>
        <li class="tile"><h3>Ügyindítás</h3><p>Reklamáció, tartozásigazolás, mérőállás és ajánlatkérés közös keretrendszerben.</p></li>
      </ul>
    </div>
  </section>
</template>
