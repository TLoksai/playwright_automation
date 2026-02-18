import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Global test directory
  testDir: './tests',

  // Test matching patterns
  testMatch: '**/*.spec.ts',

  // Timeout for each test (in milliseconds)
  timeout: 30 * 1000,

  // Timeout for expect assertions
  expect: {
    timeout: 5000,
  },

  // Fully parallel execution within files
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI
  retries: process.env.CI ? 2 : 0,

  // Run tests in files in parallel
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Global setup
  use: {
    // Base URL for all tests - points to production application
    baseURL: process.env.BASE_URL || 'https://knowsygame.netlify.app/',

    // Collect traces for failed tests
    trace: 'on-first-retry',

    // Collect screenshots on failure
    screenshot: 'only-on-failure',

    // Collect videos on failure
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,

    // Test ID attribute
    testIdAttribute: 'data-testid',

    // Locale settings
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',
  },

  // Configure projects for different browsers (6 workers)
  projects: [
    {
      name: 'Chrome Web',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'Chrome Tab',
      use: { ...devices['Galaxy Tab S4'] },
    },
    {
      name: 'Chrome Mobile',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Safari Web',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Safari iPad',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'Safari Mobile',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Local development server (not needed for production testing)
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
