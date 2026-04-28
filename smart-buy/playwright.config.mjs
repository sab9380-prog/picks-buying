import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: /.*\.e2e\.mjs/,
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], headless: true, viewport: { width: 1400, height: 900 } }
    }
  ],
  use: {
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'npx http-server . -p 4173 --silent -c-1',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000
  },
  reporter: [['list']]
});
