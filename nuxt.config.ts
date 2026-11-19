export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'hu' },
      title: 'Szikra ügyfélportál',
    },
  },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    // NUXT_BACKEND=snapshot (alapért.) -> memória-tár a JSON snapshotból (deploy, CI)
    // NUXT_BACKEND=erpnext             -> élő ERPNext (NUXT_ERP_BASE_URL + kulcs/titok)
    backend: 'snapshot',
    erpBaseUrl: '',
    erpApiKey: '',
    erpApiSecret: '',
    // NUXT_SESSION_PASSWORD -> >=32 karakteres titok a munkamenet-sütihez (élesben kötelező)
    sessionPassword: '',
    // NUXT_TEST_SEED=true -> a /__test/seed végpont él (e2e tesztek)
    testSeed: false,
    // NUXT_BUILD_SHA     -> a deployolt commit (a /api/health ezt adja vissza)
    buildSha: '',
    public: {
      // NUXT_PUBLIC_DEMO_USERS=true -> a belépő oldal listázza a demó felhasználókat
      demoUsers: false,
    },
  },
})
