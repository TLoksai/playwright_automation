import { test, expect, type Locator, type Page } from '@playwright/test';

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
  await expect(
    page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 1 })
  ).toBeVisible({ timeout: 30_000 });
}

async function openAnalyticsWorkspace(page: Page) {
  const analyticsTab = page.getByRole('tab', { name: /analytics/i }).first();
  await expect(analyticsTab).toBeVisible({ timeout: 30_000 });
  await analyticsTab.click();
  await expect(analyticsTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /top 10 most popular topics/i, level: 3 })).toBeVisible({
    timeout: 30_000,
  });
}

function sectionByHeading(page: Page, heading: RegExp): Locator {
  return page
    .locator('section, div')
    .filter({ has: page.getByRole('heading', { name: heading, level: 3 }) })
    .first();
}

async function verifyDateRangeFilters(page: Page) {
  const dateFilter = page.getByRole('combobox').first();
  await expect(dateFilter).toBeVisible({ timeout: 15_000 });
  await expect(dateFilter).toContainText(/last 30 days/i);

  await dateFilter.click();
  await expect(page.getByText(/last 7 days/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/last 30 days/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/last 90 days/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/custom range/i).first()).toBeVisible({ timeout: 10_000 });

  await page.getByText(/last 90 days/i).first().click();
  await expect(dateFilter).toContainText(/last 90 days/i);

  await dateFilter.click();
  await page.getByText(/last 7 days/i).first().click();
  await expect(dateFilter).toContainText(/last 7 days/i);

  await dateFilter.click();
  await page.getByText(/last 30 days/i).first().click();
  await expect(dateFilter).toContainText(/last 30 days/i);
}

async function verifyTopicUsageInsights(page: Page) {
  const popularTopicsSection = sectionByHeading(page, /top 10 most popular topics/i);
  await expect(popularTopicsSection).toContainText(/topics selected most frequently by players/i);
  await expect(popularTopicsSection).toContainText(/selections/i);

  const expectedTopicLabels = ['Blush Shades', 'Eye Makeup', 'Foundation Shades', 'Lip Shades'];
  for (const label of expectedTopicLabels) {
    await expect(popularTopicsSection).toContainText(new RegExp(label, 'i'));
  }

  const topicCategoriesSection = sectionByHeading(page, /topic categories/i);
  await expect(topicCategoriesSection).toContainText(/distribution of selections by category/i);
  await expect(topicCategoriesSection).toContainText(/cheeks|face|eyes|lips/i);
}

async function verifyScopedAnalytics(page: Page) {
  await expect(page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 1 })).toBeVisible();
  await expect(page.getByText(/manage your organization settings and content/i)).toBeVisible();
}

test('org admin can review org-scoped topic usage insights with date filters', async ({ page }) => {
  test.setTimeout(240_000);

  await signInAndReachDashboard(page);
  await openOrganizationDashboard(page);
  await openAnalyticsWorkspace(page);

  await verifyScopedAnalytics(page);
  await verifyDateRangeFilters(page);
  await verifyTopicUsageInsights(page);
});
