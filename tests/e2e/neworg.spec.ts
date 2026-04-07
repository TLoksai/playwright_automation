import { expect, test, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const AUTH_ENTRY_POINTS = ['https://knowsy.game/auth', 'https://knowsy.game/'];
const DASHBOARD_URL = 'https://knowsy.game/dashboard';
const ORG_NAME = 'Richelle';
const ORG_SLUG = 'richelle';
const ORG_URL = new URL(`/org/${ORG_SLUG}`, APP_URL).toString();
const EMPTY_STATE_TITLE = /No games played yet|No Analytics Data Yet/i;
const EMPTY_STATE_DESCRIPTION =
  /create your first game to see data here|Analytics will appear here once players start making topic selections in your games\./i;

const credentials = {
  email: 'richelle2305@gmail.com',
  password: 'Richelle23#',
};

const escapeForRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function closeWelcomeModalIfPresent(page: Page) {
  const welcomeDialog = page.getByRole('dialog', { name: /welcome to knowsy/i });
  if (!(await welcomeDialog.count())) return;
  if (!(await welcomeDialog.isVisible().catch(() => false))) return;

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
  if (!(await navSignIn.count())) return null;

  await navSignIn.click();
  await page.waitForLoadState('domcontentloaded');
  await closeWelcomeModalIfPresent(page);
  return locateSignInFormInputs(page);
}

async function ensureSignInForm(page: Page) {
  for (const targetUrl of AUTH_ENTRY_POINTS) {
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    await closeWelcomeModalIfPresent(page);

    const formInputs = await locateSignInFormInputs(page);
    if (formInputs) return formInputs;

    const navAttempt = await tryOpenSignInThroughNavigation(page);
    if (navAttempt) return navAttempt;
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

  await page.waitForURL(new RegExp(`/dashboard/${ORG_SLUG}$`, 'i'), { timeout: 60_000 });
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
}

async function openTopicsWorkspace(page: Page) {
  const topicsTab = page.getByRole('tab', { name: /topics/i }).first();
  await expect(topicsTab).toBeVisible({ timeout: 30_000 });
  await topicsTab.click();
  await expect(topicsTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: /custom topics/i, level: 3 })).toBeVisible({ timeout: 15_000 });
}

function topicCard(page: Page, topicName: string): Locator {
  const matcher = new RegExp(escapeForRegex(topicName), 'i');
  return page.locator('section,div').filter({ has: page.getByRole('heading', { name: matcher, level: 3 }) }).first();
}

async function createTopic(page: Page, topicName: string, category: string) {
  await page.getByRole('button', { name: /new topic/i }).click();
  const dialog = page.getByRole('dialog', { name: /create new topic/i });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  await dialog.getByRole('textbox', { name: /topic name/i }).fill(topicName);
  await dialog.getByRole('textbox', { name: /category/i }).fill(category);
  await dialog.getByRole('button', { name: /create topic/i }).click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
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

async function seedTopicForGameplay(page: Page, topicName: string, category: string, items: string[]) {
  await openTopicsWorkspace(page);
  await createTopic(page, topicName, category);
  const manageItemsDialog = await openManageItems(page, topicName);
  await addItemsToTopic(page, manageItemsDialog, items);
}

async function assertEmptyAnalyticsState(page: Page) {
  await expect(page.getByRole('heading', { name: EMPTY_STATE_TITLE }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(EMPTY_STATE_DESCRIPTION).first()).toBeVisible({ timeout: 15_000 });

  const zeroValueSummaryCards = [
    /total selections/i,
    /unique players/i,
    /custom topics/i,
    /auth players/i,
  ];

  for (const heading of zeroValueSummaryCards) {
    await expect(page.getByText(heading).first()).toBeVisible({ timeout: 15_000 });
  }

  const zeroValues = ['0', '0', '0', '0'];
  for (const value of zeroValues) {
    await expect(page.getByText(new RegExp(`^${value}$`)).first()).toBeVisible({ timeout: 15_000 });
  }

  await expect(page.getByRole('button', { name: /export csv/i }).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: /export pdf/i }).first()).toBeDisabled();

  const chartAndTableHeadings = [
    /engagement trend/i,
    /topic type usage/i,
    /player type distribution/i,
    /top 10 most popular topics/i,
    /topic categories/i,
  ];

  for (const heading of chartAndTableHeadings) {
    await expect(page.getByText(heading).first()).toHaveCount(0);
  }
}

async function submitAction(page: Page, button: Locator, input: Locator) {
  await button.scrollIntoViewIfNeeded().catch(() => undefined);
  const buttonCenter = await button
    .boundingBox()
    .then((box) => (box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null))
    .catch(() => null);

  const attempts: Array<() => Promise<void>> = [
    () => button.tap(),
    () => button.click(),
    () => button.click({ force: true }),
    () => input.press('Enter'),
    async () => {
      if (buttonCenter) {
        await page.mouse.click(buttonCenter.x, buttonCenter.y);
      }
    },
    () =>
      button.evaluate((element: HTMLButtonElement) => {
        element.click();
      }),
  ];

  for (const attempt of attempts) {
    await attempt().catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

async function waitForText(page: Page, pattern: RegExp, timeoutMs = 90_000) {
  await expect
    .poll(
      async () => ((await page.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
      { timeout: timeoutMs }
    )
    .toMatch(pattern);
}

async function addPlayersUntilGameCanStart(page: Page) {
  const addAiButton = page.getByTestId('add-ai-player-btn').first();
  const startGameButton = page.getByRole('button', { name: /start game/i }).first();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await startGameButton.isEnabled().catch(() => false)) {
      return;
    }

    if (!(await isVisible(addAiButton))) {
      break;
    }

    await addAiButton.click();

    try {
      await expect
        .poll(
          async () => {
            const playersText = (await page.getByText(/players\s*\(\d+\/\d+\)/i).first().textContent().catch(() => '')) ?? '';
            return playersText;
          },
          { timeout: 10_000 }
        )
        .not.toMatch(/players\s*\(1\/\d+\)/i);
    } catch {
      await page.waitForTimeout(1_000);
    }
  }

  await expect(startGameButton).toBeEnabled({ timeout: 30_000 });
}

async function selectTopicsForRound(page: Page, items: string[]) {
  for (const item of items) {
    const button = page.getByRole('button', { name: new RegExp(escapeForRegex(item), 'i') }).first();
    await button.waitFor({ state: 'visible', timeout: 30_000 });
    await button.click();
  }
}

async function createFirstOrgGame(
  browser: Parameters<typeof test>[0]['browser'],
  topicName: string,
  topicItems: string[]
) {
  const gameContext = await browser.newContext();
  const gamePage = await gameContext.newPage();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  await gamePage.goto(ORG_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await gamePage.waitForLoadState('networkidle').catch(() => undefined);

  const playNowButton = gamePage.getByRole('button', { name: /play now/i }).first();
  if (await isVisible(playNowButton)) {
    await playNowButton.click();
  }

  const hostNameInput = (await gamePage.getByTestId('create-room-name-input').count())
    ? gamePage.getByTestId('create-room-name-input')
    : gamePage.getByPlaceholder('Enter your name').first();
  await expect(hostNameInput).toBeVisible({ timeout: 30_000 });
  await hostNameInput.fill(`Host ${runId}`);

  const createRoomButton = (await gamePage.getByTestId('create-room-submit').count())
    ? gamePage.getByTestId('create-room-submit')
    : gamePage.getByRole('button', { name: /create game room/i }).first();
  await submitAction(gamePage, createRoomButton, hostNameInput);

  await waitForText(gamePage, /waiting for players|players\s*\(\d+\/\d+\)/i, 60_000);
  await addPlayersUntilGameCanStart(gamePage);
  await gamePage.getByRole('button', { name: /start game/i }).first().click();

  await waitForText(gamePage, /round 1|topic selection|select a topic/i, 60_000);

  const topicButton = gamePage.getByRole('button', { name: new RegExp(escapeForRegex(topicName), 'i') }).first();
  await topicButton.waitFor({ state: 'visible', timeout: 30_000 });
  await topicButton.click();

  await selectTopicsForRound(gamePage, topicItems);

  const submitSelectionButton = gamePage
    .getByTestId('submit-selection-btn')
    .or(gamePage.getByRole('button', { name: /submit selection/i }))
    .first();
  await expect(submitSelectionButton).toBeEnabled({ timeout: 15_000 });
  await submitSelectionButton.click();

  const guessSubmitButton = gamePage.getByTestId('vip-guess-submit-btn').first();
  if (await isVisible(guessSubmitButton)) {
    await guessSubmitButton.click();
  }

  await waitForText(gamePage, /next vip|round results|continue|end game/i, 90_000);

  const nextVipButton = gamePage.getByTestId('next-vip-btn').first();
  if (await isVisible(nextVipButton)) {
    await nextVipButton.click();
    await waitForText(gamePage, /end game|game complete|final scores/i, 90_000);
  }

  const endGameButton = gamePage.getByTestId('end-game-btn').first();
  if (await isVisible(endGameButton)) {
    await endGameButton.click();
  } else {
    await gamePage.getByRole('button', { name: /end game/i }).first().click();
  }

  await waitForText(gamePage, /game complete|final scores|back to lobby/i, 90_000);

  return { gameContext, gamePage };
}

async function assertAnalyticsPopulatesWithoutHardRefresh(page: Page) {
  await page.bringToFront();
  await closeWelcomeModalIfPresent(page);

  const overviewTab = page.getByRole('tab', { name: /overview/i }).first();
  const analyticsTab = page.getByRole('tab', { name: /analytics/i }).first();

  await overviewTab.click();
  await analyticsTab.click();
  await expect(analyticsTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });

  await expect(page.getByRole('heading', { name: EMPTY_STATE_TITLE }).first()).toHaveCount(0);
  await expect(page.getByText(EMPTY_STATE_DESCRIPTION).first()).toHaveCount(0);

  await expect(page.getByText(/total selections/i).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/unique players/i).first()).toBeVisible({ timeout: 90_000 });
}

test.describe('new organization analytics empty state', () => {
  test.describe.configure({ timeout: 480_000 });

  test('org admin sees zeroed analytics cards and a dedicated empty state for a new organization', async ({ page }) => {
    await signInAndReachDashboard(page);
    await openOrganizationDashboard(page);
    await openAnalyticsWorkspace(page);
    await assertEmptyAnalyticsState(page);
  });
});
