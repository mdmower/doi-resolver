import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
  },
  globalSetup: './tests/global.setup.ts',
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome'], channel: 'chromium'},
    },
  ],
});
