import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_URL = 'https://knowsy.game/auth';
const DASHBOARD_URL = 'https://knowsy.game/dashboard';
const ORG_NAME = 'RICHELLE SALDANHA';
const credentials = {
  email: 'richelle2305@gmail.com',
  password: 'Richelle23#',
};
const brandLogoPath = path.join(process.cwd(), 'tests', 'fixtures', 'brand-logo.svg');
const primaryColor = '#0f766e';

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

async function openBrandingWorkspace(page: Page) {
  const brandingTab = page.getByRole('tab', { name: /branding/i }).first();
  await expect(brandingTab).toBeVisible({ timeout: 30_000 });
  await brandingTab.click();
  await expect(brandingTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /organization branding/i, level: 3 })).toBeVisible({ timeout: 15_000 });
}

async function locateLogoUploadInput(page: Page) {
  const uploadInputs = page.locator('input[type="file"]');
  await expect(uploadInputs.first()).toBeAttached({ timeout: 15_000 });
  return uploadInputs.first();
}

async function expectTouchFriendlyControl(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(40);
}

async function expectTappableControl(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(36);
}

async function expectWithinViewport(page: Page, locator: Locator, options?: { scrollIntoView?: boolean }) {
  await expect(locator).toBeVisible({ timeout: 15_000 });
  if (options?.scrollIntoView) {
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
  }
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();

  const box = await locator.boundingBox();
  expect(box).toBeTruthy();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function saveBranding(page: Page) {
  const saveButton = page.getByRole('button', { name: /save branding/i });
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  await saveButton.click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: /save branding/i })).toBeVisible({ timeout: 15_000 });
}

function primaryColorTextInput(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByText(/^Primary Color$/) })
    .first()
    .locator('input[type="text"]')
    .first();
}

function primaryColorPickerInput(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByText(/^Primary Color$/) })
    .first()
    .locator('input[type="color"]')
    .first();
}

function primaryColorField(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByText(/^Primary Color$/) })
    .first();
}

test('org admin can use branding settings on mobile without layout issues', async ({ page }) => {
  test.setTimeout(240_000);
  test.skip(!/Chrome Mobile|Safari Mobile/i.test(test.info().project.name), 'Mobile branding UX is only verified on phone projects.');

  await signInAndReachDashboard(page);
  await openOrganizationDashboard(page);
  await openBrandingWorkspace(page);

  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  expect(viewport!.width).toBeGreaterThanOrEqual(360);

  const logoFixtureSize = fs.statSync(brandLogoPath).size;
  expect(logoFixtureSize).toBeLessThan(2 * 1024 * 1024);

  const orgLogoButton = page.getByRole('button', { name: /organization logo/i }).first();
  await expectTappableControl(orgLogoButton);
  await orgLogoButton.click({ trial: true });
  await expectWithinViewport(page, orgLogoButton);

  const fileInput = await locateLogoUploadInput(page);
  const acceptValue = (await fileInput.getAttribute('accept')) ?? '';
  if (acceptValue) {
    expect(acceptValue.toLowerCase()).toMatch(/image\/\*|png|svg/);
  }

  const logoPreview = page.getByRole('img', { name: /logo preview/i });
  const previousPreviewSrc = await logoPreview.getAttribute('src');
  await fileInput.setInputFiles(brandLogoPath);
  await expect(logoPreview).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const nextPreviewSrc = await logoPreview.getAttribute('src');
      return nextPreviewSrc && nextPreviewSrc !== previousPreviewSrc ? 'changed' : '';
    }, { timeout: 15_000 })
    .toBe('changed');

  const primaryColorInput = primaryColorTextInput(page);
  const primaryColorPicker = primaryColorPickerInput(page);
  const primaryColorContainer = primaryColorField(page);
  await expect(primaryColorInput).toBeVisible({ timeout: 15_000 });
  await expect(primaryColorPicker).toBeAttached({ timeout: 15_000 });
  await expectTouchFriendlyControl(primaryColorInput);
  await expect(primaryColorContainer).toBeVisible({ timeout: 15_000 });

  const colorBounds = await primaryColorContainer.boundingBox();
  expect(colorBounds).toBeTruthy();
  expect(colorBounds!.x).toBeGreaterThanOrEqual(0);
  expect(colorBounds!.x + colorBounds!.width).toBeLessThanOrEqual(viewport!.width);

  await primaryColorInput.fill(primaryColor);
  await primaryColorPicker.evaluate((input, value) => {
    const element = input as HTMLInputElement;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, primaryColor);
  await expect(primaryColorInput).toHaveValue(primaryColor);

  await expect(logoPreview).toBeVisible({ timeout: 15_000 });
  await expectWithinViewport(page, logoPreview, { scrollIntoView: true });
  await expectWithinViewport(page, primaryColorPicker, { scrollIntoView: true });

  const saveButton = page.getByRole('button', { name: /save branding/i });
  await expectTappableControl(saveButton);
  await expectWithinViewport(page, saveButton, { scrollIntoView: true });

  await saveBranding(page);
  await expect(primaryColorTextInput(page)).toHaveValue(primaryColor, { timeout: 15_000 });
});
