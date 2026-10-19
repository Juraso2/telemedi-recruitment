import { networkInterfaces } from 'node:os'
import { defineConfig, devices } from '@playwright/test'

const netbird = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === 'IPv4' && address.address.startsWith('100.'))?.address
const apiPort = process.env.E2E_API_PORT ?? '3100'
const frontendPort = process.env.E2E_PORT ?? '5174'
const baseURL = process.env.E2E_BASE_URL ?? `http://${netbird ?? '127.0.0.1'}:${frontendPort}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'off', screenshot: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: [
    {
      command: 'vp run --filter @telemedi/backend test:server',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      timeout: 30_000,
    },
    {
      command: `vp run --filter @telemedi/frontend dev --port ${frontendPort}`,
      url: baseURL,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
      timeout: 30_000,
    },
  ],
})
