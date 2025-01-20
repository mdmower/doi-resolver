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
  projects: [
    {
      name: 'modify manifest',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome'], channel: 'chromium'},
      dependencies: ['modify manifest'],
    },
    {
      name: 'restore manifest',
      testMatch: /global\.teardown\.ts/,
      dependencies: ['chromium'],
    },
  ],
});
