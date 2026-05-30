import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const STORAGE_STATE = path.resolve(process.cwd(), 'tests/e2e/.auth/storageState.json');

const baseURL =
  process.env.E2E_ENV === 'prod'
    ? 'https://vendor-pass.vercel.app'
    : 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000, // la extracción IA (PDF + LLM) puede tardar
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/.report', open: 'never' }],
  ],
  use: {
    baseURL,
    headless: false, // visible para revisión visual
    viewport: { width: 1280, height: 900 },
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: 250 },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    {
      name: 'documents',
      testMatch: /tests[\\/]e2e[\\/]documents[\\/].*\.spec\.ts$/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
    },
    {
      name: 'full-system',
      testMatch: /full-system\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
