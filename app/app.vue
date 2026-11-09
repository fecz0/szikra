<template>
  <div class="shell">
    <header class="top">
      <NuxtLink to="/" class="logo" data-testid="brand-logo">
        <svg class="logo-icon" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">
          <path d="M14 1.5 17.2 10.8 26.5 14 17.2 17.2 14 26.5 10.8 17.2 1.5 14 10.8 10.8Z" fill="currentColor" />
        </svg>
        <span class="logo-text">Szikra</span>
      </NuxtLink>
      <span class="tag">demó</span>
    </header>
    <main><NuxtPage /></main>
    <footer>Szikra demó · kitalált adatok · nem valódi szolgáltató</footer>
  </div>
</template>
