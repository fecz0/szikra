<script setup lang="ts">
const route = useRoute()
const pageTitle = computed(() => (route.path === '/' ? 'Főoldal' : 'Partnerportál'))
</script>

<template>
  <div class="site">
    <header class="top">
      <div class="top-in">
        <div class="brandbox">
          <NuxtLink to="/" class="logo" data-testid="brand-logo" aria-label="Szikra">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
            </svg>
            <span>Szikra</span>
          </NuxtLink>
          <p class="page-title" data-testid="page-title">{{ pageTitle }}</p>
        </div>
        <nav class="menu" aria-label="Főmenü">
          <NuxtLink to="/#demo">Demó felhasználók</NuxtLink>
          <a href="/report/">Tesztriport</a>
          <a href="https://github.com/fecz0/szikra" rel="noopener">Forráskód</a>
        </nav>
      </div>
    </header>
    <main><NuxtLayout><NuxtPage /></NuxtLayout></main>
    <footer class="foot">
      <div class="foot-in">Szikra demó · kitalált adatok · nem valódi szolgáltató</div>
    </footer>
  </div>
</template>
