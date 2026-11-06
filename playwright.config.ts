import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.PORT ?? 3100)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on',
    // A demóhoz: minden teszt videóját megőrizzük (PR-kommentben/riportban megmutatható).
    video: 'on',
    screenshot: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // CI-ben a build előző lépésben készül; lokálisan itt építjük.
    command: process.env.CI
      ? 'node .output/server/index.mjs'
      : 'pnpm build && node .output/server/index.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT: String(PORT), HOST: '127.0.0.1', NUXT_MOCK_SAP: 'true' },
  },
})
