import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 300_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1180, height: 820 }, // iPad landscape
    // Use the environment's pre-installed Chromium when present (e.g. CI
    // containers that pre-bake browsers); falls back to Playwright's own.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
