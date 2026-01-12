import { defineConfig, devices } from '@playwright/test'

// Inside Docker, use nginx service name. On host, use localhost:8080
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://nginx:80'

export default defineConfig({
  testDir: './e2e',
  // Run tests serially to avoid race conditions with shared localStorage and app state.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Add retries to handle occasional flakiness from localStorage/React hydration timing
  retries: 2,
  workers: 1,
  reporter: 'html',
  timeout: 45000,
  // Expect timeout should be slightly less than test timeout
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Increase action timeout for slow CI environments
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Start each test with a fresh browser context (no cookies or storage)
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
  ],
})
