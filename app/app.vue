<template>
  <div class="shell">
    <header class="top">
      <NuxtLink to="/" class="logo" data-testid="brand-logo" aria-label="Szikra">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
        </svg>
        <span>Szikra</span>
      </NuxtLink>
      <span class="tag">demó</span>
    </header>
    <main><NuxtPage /></main>
    <footer>Szikra demó · kitalált adatok · nem valódi szolgáltató</footer>
  </div>
</template>
