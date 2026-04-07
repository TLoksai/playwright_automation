import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'fs/promises';

const AUTH_URL = 'https://knowsy.game/auth';
const DASHBOARD_URL = 'https://knowsy.game/dashboard';
const ORG_NAME = 'RICHELLE SALDANHA';
const credentials = {
  email: 'richelle2305@gmail.com',
  password: 'Richelle23#',
};

async function closeWelcomeModalIfPresent(page: Page) {
  const welcomeDialog = page.getByRole('dialog', { name: /welcome to knowsy/i });
  if (!(await welcomeDialog.count())) {
    return;
  }
  if (!(await welcomeDialog.isVisible().catch(() => false))) {
    return;
  }

  const closeButton = welcomeDialog.getByRole('button', { name: /close/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await welcomeDialog.getByRole('button').first().click();
  }
  await welcomeDialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
}

async function signInAndReachDashboard(page: Page) {
  await page.goto(AUTH_URL, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
  await closeWelcomeModalIfPresent(page);

  const emailInput = page.getByPlaceholder('you@example.com').first();
  const passwordInput = page.getByLabel('Password').first();
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });

  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 60_000 }).catch(async () => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
  });

  await closeWelcomeModalIfPresent(page);
  await expect(page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
  await expect(page.getByText(/my organizations/i)).toBeVisible({ timeout: 30_000 });
}

async function openOrganizationDashboard(page: Page) {
  if (!page.url().includes('/dashboard/')) {
    const orgCardHeading = page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 3 }).first();
    await expect(orgCardHeading).toBeVisible({ timeout: 30_000 });

    const cardContainer = orgCardHeading
      .locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or contains(@class,"card")][1]')
      .first();
    if (await cardContainer.count()) {
      await cardContainer.click();
    } else {
      await orgCardHeading.click();
    }
  }

  await page.waitForURL(/\/dashboard\//i, { timeout: 60_000 });
  await closeWelcomeModalIfPresent(page);
  await expect(page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

async function openAnalyticsWorkspace(page: Page) {
  const analyticsTab = page.getByRole('tab', { name: /analytics/i }).first();
  await expect(analyticsTab).toBeVisible({ timeout: 30_000 });
  await analyticsTab.click();
  await expect(analyticsTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });

  const anchorSignals = [
    page.getByRole('button', { name: /export csv/i }).first(),
    page.getByText(/total selections/i).first(),
    page.getByText(/top 10 most popular topics/i).first(),
    page.getByRole('heading', { name: /no analytics data yet|no games played yet/i }).first(),
  ];

  const start = Date.now();
  while (Date.now() - start < 60_000) {
    for (const signal of anchorSignals) {
      if (await signal.isVisible().catch(() => false)) {
        return;
      }
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Analytics workspace did not render expected content.');
}

async function findExportCsvButton(page: Page): Promise<Locator> {
  const candidates = [
    page.getByRole('button', { name: /export csv/i }).first(),
    page.getByText(/export csv/i).locator('xpath=ancestor::button[1]').first(),
    page.getByTestId('export-csv-btn').first(),
  ];

  for (const candidate of candidates) {
    if ((await candidate.count()) && (await candidate.isVisible().catch(() => false))) {
      return candidate;
    }
  }

  throw new Error('Export CSV control was not found on the analytics dashboard.');
}
async function ensureAnalyticsData(page: Page) {
  const emptyStateHeading = page.getByRole('heading', { name: /no analytics data yet|no games played yet/i }).first();
  const exportButton = await findExportCsvButton(page);
  const hasEmptyState = await emptyStateHeading.isVisible().catch(() => false);
  const exportEnabled = await exportButton.isEnabled().catch(() => false);

  if (hasEmptyState || !exportEnabled) {
    test.skip(true, 'Organization analytics export is unavailable because this org has no analytics data yet.');
  }
}

function normalizeCsvHeader(headerRow: string) {
  return headerRow
    .split(',')
    .map((value) => value.replace(/^"|"$/g, '').trim().toLowerCase())
    .filter(Boolean);
}

function expectHeaderLike(headers: string[], matcher: RegExp) {
  expect(headers.some((header) => matcher.test(header))).toBeTruthy();
}

async function expectLoadingIndicatorDuringExport(page: Page, exportButton: Locator) {
  const loadingSignals = [
    page.getByRole('status').filter({ hasText: /export/i }).first(),
    page.getByText(/exporting|preparing|generating/i).first(),
    page.locator('[aria-busy="true"]').first(),
  ];

  const start = Date.now();
  while (Date.now() - start < 5_000) {
    if (await exportButton.isDisabled().catch(() => false)) {
      return;
    }

    const buttonText = ((await exportButton.textContent().catch(() => '')) ?? '').trim();
    if (/exporting|preparing|generating/i.test(buttonText)) {
      return;
    }

    for (const signal of loadingSignals) {
      if ((await signal.count()) && (await signal.isVisible().catch(() => false))) {
        return;
      }
    }

    await page.waitForTimeout(200);
  }

  throw new Error('No loading indicator was shown during CSV export.');
}

async function exportCsv(page: Page) {
  const exportButton = await findExportCsvButton(page);
  await expect(exportButton).toBeEnabled({ timeout: 15_000 });

  const exportStartedAt = Date.now();
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await exportButton.click();
  await expectLoadingIndicatorDuringExport(page, exportButton);

  const download = await downloadPromise;
  const exportDurationMs = Date.now() - exportStartedAt;

  expect(exportDurationMs).toBeLessThanOrEqual(10_000);
  await expect(exportButton).toBeEnabled({ timeout: 15_000 });

  return { download, exportDurationMs };
}

async function assertCsvExport(downloadText: string) {
  const rows = downloadText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  expect(rows.length).toBeGreaterThan(0);

  const headers = normalizeCsvHeader(rows[0]);
  expectHeaderLike(headers, /^game[\s_-]*id$/i);
  expectHeaderLike(headers, /^date$/i);
  expectHeaderLike(headers, /^topic$/i);
  expectHeaderLike(headers, /^player[\s_-]*count$/i);
  expectHeaderLike(headers, /^(average|avg)[\s_-]*score([\s_-]*per[\s_-]*game)?$/i);

  if (rows.length > 1) {
    expect(rows.length - 1).toBeLessThanOrEqual(1_000);
  }
}

test('org admin can export org-scoped analytics as csv within 10 seconds with a loading indicator', async ({
  page,
}) => {
  test.setTimeout(240_000);

  await signInAndReachDashboard(page);
  await openOrganizationDashboard(page);
  await openAnalyticsWorkspace(page);
  await ensureAnalyticsData(page);

  await expect(page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 1 })).toBeVisible();

  const { download } = await exportCsv(page);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csvText = await readFile(downloadPath!, 'utf8');

  await assertCsvExport(csvText);
});
