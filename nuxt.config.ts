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
    // NUXT_MOCK_SAP=true  -> a beépített mock SAP (/mock-sap) elérhető
    mockSap: false,
    // NUXT_SAP_BASE_URL   -> a SAP interfész alap URL-je (mock esetén üresen is jó)
    sapBaseUrl: '',
    // NUXT_BUILD_SHA     -> a deployolt commit (a /api/health ezt adja vissza)
    buildSha: '',
    public: {
      // NUXT_PUBLIC_DEMO_USERS=true -> fix demó ügyfelek létrejönnek és listázva vannak a belépő oldalon
      demoUsers: false,
    },
  },
})
