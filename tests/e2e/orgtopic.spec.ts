import { test, expect, type Locator, type Page } from '@playwright/test';

const AUTH_ENTRY_POINTS = [
  'https://knowsy.game/auth',
  'https://knowsy.game/',
 
];
const DASHBOARD_URL = 'https://knowsy.game/dashboard';
const credentials = {
  email: 'richelle2305@gmail.com',
  password: 'Richelle23#',
};
const expectedOrgOwner = 'RICHELLE SALDANHA';

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

async function locateSignInFormInputs(page: Page) {
  const emailInput = page.getByPlaceholder('you@example.com').first();
  const passwordInput = page.getByLabel('Password').first();
  if ((await emailInput.count()) && (await passwordInput.count())) {
    return { emailInput, passwordInput };
  }
  return null;
}

async function tryOpenSignInThroughNavigation(page: Page) {
  const navSignIn = page.getByRole('link', { name: /sign in/i }).first();
  if (!(await navSignIn.count())) {
    return null;
  }
  await navSignIn.click();
  await page.waitForLoadState('domcontentloaded');
  await closeWelcomeModalIfPresent(page);
  return locateSignInFormInputs(page);
}

async function ensureSignInForm(page: Page) {
  for (const targetUrl of AUTH_ENTRY_POINTS) {
    test.info().annotations.push({ type: 'target-url', description: targetUrl });
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    await closeWelcomeModalIfPresent(page);
    const formInputs = await locateSignInFormInputs(page);
    if (formInputs) {
      return formInputs;
    }
    const navAttempt = await tryOpenSignInThroughNavigation(page);
    if (navAttempt) {
      return navAttempt;
    }
  }

  const sitePausedHeading = page.getByRole('heading', { name: /site not available/i });
  if (await sitePausedHeading.count()) {
    test.skip('Knowsy auth experience is paused on Netlify (usage limits).');
  }
  throw new Error('Unable to reach the Knowsy sign-in form via known entry points.');
}

async function signInAndReachDashboard(page: Page) {
  const { emailInput, passwordInput } = await ensureSignInForm(page);
  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  await closeWelcomeModalIfPresent(page);
  await page.getByRole('button', { name: /sign in/i }).click();

  let reachedDashboard = false;
  await Promise.all([
    page
      .waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 60_000 })
      .then(() => {
        reachedDashboard = true;
      })
      .catch(() => {}),
    closeWelcomeModalIfPresent(page),
  ]);

  if (!reachedDashboard) {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
  }
  await closeWelcomeModalIfPresent(page);
  await expect(page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
  await expect(page.getByText(/my organizations/i)).toBeVisible({ timeout: 30_000 });
}

async function openOrganizationDashboard(page: Page) {
  if (page.url().includes('/dashboard/')) {
    await expect(page.getByRole('heading', { name: new RegExp(expectedOrgOwner, 'i'), level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    return;
  }

  const orgCardHeading = page.getByRole('heading', { name: new RegExp(expectedOrgOwner, 'i'), level: 3 }).first();
  await expect(orgCardHeading).toBeVisible({ timeout: 30_000 });

  const cardContainer = orgCardHeading
    .locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or contains(@class,"card")][1]')
    .first();
  if (await cardContainer.count()) {
    await cardContainer.click();
  } else {
    await orgCardHeading.click();
  }

  await page.waitForURL(/\/dashboard\//i, { timeout: 60_000 });
  await closeWelcomeModalIfPresent(page);
  await expect(page.getByRole('heading', { name: new RegExp(expectedOrgOwner, 'i'), level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

async function openTopicsWorkspace(page: Page) {
  const topicsTab = page.getByRole('tab', { name: /topics/i });
  await topicsTab.click();
  await expect(topicsTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /custom topics/i, level: 3 })).toBeVisible({ timeout: 15_000 });
}

async function createTopic(page: Page, topicName: string, category: string) {
  await page.getByRole('button', { name: /new topic/i }).click();
  const dialog = page.getByRole('dialog', { name: /create new topic/i });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });

  await dialog.getByRole('textbox', { name: /topic name/i }).fill(topicName);
  await dialog.getByRole('textbox', { name: /category/i }).fill(category);
  await dialog.getByRole('button', { name: /create topic/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  await page.getByText(/topic created successfully/i).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
}

function topicCard(page: Page, topicName: string): Locator {
  const matcher = new RegExp(escapeForRegex(topicName), 'i');
  return page.locator('section,div').filter({ has: page.getByRole('heading', { name: matcher, level: 3 }) }).first();
}

async function openManageItems(page: Page, topicName: string) {
  const card = topicCard(page, topicName);
  await expect(card).toBeVisible({ timeout: 20_000 });
  const manageButton = card.getByRole('button', { name: /manage items/i }).first();
  await manageButton.click();
  const dialog = page.getByRole('dialog', { name: /manage topic items/i });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  return dialog;
}

async function addItemsToTopic(page: Page, dialog: Locator, items: string[]) {
  const itemInput = dialog.getByRole('textbox', { name: /item name/i }).first();
  const addButton = dialog.getByRole('button', { name: /add item/i }).first();

  for (const item of items) {
    await itemInput.fill(item);
    await addButton.click();
    const successToast = page.getByText(/item added successfully/i).first();
    await successToast.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await successToast.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }

  await dialog.getByRole('button', { name: /close/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
}

async function verifyTopicItems(page: Page, topicName: string, items: string[]) {
  const dialog = await openManageItems(page, topicName);
  for (const item of items) {
    await expect(dialog.getByText(item, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  }
  await dialog.getByRole('button', { name: /close/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
}

test('organization admin can create a topic and manage its items', async ({ page }) => {
  test.setTimeout(180_000);

  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(-9);
  const topicName = `QA Topic ${timestamp}`;
  const topicCategory = `QA Cat ${timestamp}`;
  const topicItems = Array.from({ length: 5 }, (_, index) => `QA Item ${index + 1} - ${timestamp}`);

  await signInAndReachDashboard(page);
  await openOrganizationDashboard(page);
  await openTopicsWorkspace(page);
  await createTopic(page, topicName, topicCategory);

  const manageItemsDialog = await openManageItems(page, topicName);
  await addItemsToTopic(page, manageItemsDialog, topicItems);

  const createdCard = topicCard(page, topicName);
  await expect(createdCard.getByText(topicCategory)).toBeVisible({ timeout: 10_000 });
  await verifyTopicItems(page, topicName, topicItems);

  await page.getByRole('tab', { name: /overview/i }).click();
  await expect(page.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true');
});
