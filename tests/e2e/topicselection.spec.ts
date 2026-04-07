import { test, expect, type Locator, type Page, type Request, type Route } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TOPIC_TITLE = 'Most Adorable Pet';
const FALLBACK_TOPIC_ITEMS = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds', 'Fish', 'Turtles', 'Lizards'];

async function waitForEntryPoints(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => {
    const playLink = document.querySelector('a[href="/play"]');
    const startButton = Array.from(document.querySelectorAll('button')).find((btn) =>
      /start playing/i.test(btn.textContent ?? '')
    );
    const isVisible = (el: Element | null | undefined) => !!el && !!(el as HTMLElement).offsetParent;
    return isVisible(playLink) || isVisible(startButton);
  }, null, { timeout: 60_000 });
}

async function openPlayScreen(page: Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await waitForEntryPoints(page);

  const playNowLink = page.getByRole('link', { name: 'Play Now' }).first();
  const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();

  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else if (await startPlayingButton.isVisible().catch(() => false)) {
    await startPlayingButton.click();
  } else {
    throw new Error('Unable to find Play Now or Start Playing entry points.');
  }
}

async function createRoomAndGetCode(page: Page, hostName: string) {
  let navigated = false;
  for (let attempt = 0; attempt < 3 && !navigated; attempt++) {
    await openPlayScreen(page);
    const hostInput = page.getByTestId('create-room-name-input');
    const createGameButton = page.getByRole('button', { name: 'Create Game' });
    await expect(hostInput).toBeVisible({ timeout: 60_000 });
    await hostInput.fill(hostName);
    await expect(createGameButton).toBeEnabled({ timeout: 30_000 });
    await createGameButton.click();
    try {
      await expect(page).toHaveURL(/\/game\//, { timeout: 60_000 });
      navigated = true;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  const playersHeading = page.getByRole('heading', { name: /^Players/i }).first();
  await expect(playersHeading).toBeVisible({ timeout: 60_000 });
  await expect(playersHeading).toContainText('(1/6)', { timeout: 60_000 });
  const roomCodeLocator = page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first();
  await expect(roomCodeLocator).toBeVisible({ timeout: 60_000 });
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code not found after creating the room.');
  }
  return roomCode;
}

async function ensureMinimumPlayers(page: Page, requiredCount: number) {
  const playersHeading = page.getByRole('heading', { name: /^Players/i }).first();
  await expect(playersHeading).toBeVisible({ timeout: 60_000 });

  const addAiButton = page.getByRole('button', { name: /add ai player/i }).first();
  let guard = 0;
  while (true) {
    const headingText = await playersHeading.innerText();
    const match = headingText.match(/\((\d+)\/(\d+)\)/);
    if (!match) {
      throw new Error(`Unable to parse players heading: ${headingText}`);
    }
    const currentCount = Number(match[1]);
    if (currentCount >= requiredCount) {
      return playersHeading;
    }
    await expect(addAiButton).toBeVisible({ timeout: 30_000 });
    await addAiButton.click();
    guard += 1;
    if (guard > 5) {
      throw new Error(`Could not reach ${requiredCount} players via AI helpers.`);
    }
  }
}

async function setupTopicSelection(page: Page, hostName: string) {
  const roomCode = await createRoomAndGetCode(page, hostName);

  const playersHeading = await ensureMinimumPlayers(page, 2);
  const startGameButton = page.getByRole('button', { name: 'Start Game' }).first();
  await expect(startGameButton).toBeEnabled({ timeout: 60_000 });
  await startGameButton.click();

  await expect(page.getByRole('heading', { name: /Round 1 - Topic Selection/i })).toBeVisible({ timeout: 90_000 });
  const topicButton = page.getByRole('button', { name: TOPIC_TITLE }).first();
  await expect(topicButton).toBeVisible({ timeout: 30_000 });
  const topicItemsResponse = page.waitForResponse(
    (response) => response.url().includes('/rest/v1/topic_items') && response.request().method() === 'GET',
    { timeout: 30_000 }
  ).catch(() => null);
  await topicButton.click();
  await topicItemsResponse;
  await waitForAnyTopicItem(page);

  return { roomCode };
}

async function waitForAnyTopicItem(page: Page) {
  for (const candidate of FALLBACK_TOPIC_ITEMS) {
    const optionButton = page.getByRole('button', { name: candidate }).first();
    if ((await optionButton.count()) > 0) {
      await optionButton.waitFor({ state: 'visible', timeout: 30_000 });
      return;
    }
  }
  throw new Error('Topic items did not render in time.');
}

async function selectItems(page: Page, itemNames: string[]) {
  for (const name of itemNames) {
    const button = page.getByRole('button', { name }).first();
    await button.waitFor({ state: 'visible', timeout: 20_000 });
    await button.click();
    await page.waitForTimeout(100);
  }
}

async function readSelectionCount(page: Page) {
  const counterHeading = page.getByRole('heading', { name: /select\s+\d+\s+items/i }).first();
  if ((await counterHeading.count()) > 0) {
    const labelText = await counterHeading.innerText();
    const match = labelText.match(/\((\d+)\s*\/\s*(\d+)/);
    if (match) {
      return { selected: Number(match[1]), total: Number(match[2]) };
    }
  }
  const selected = await sortableItemsLocator(page).count();
  return { selected, total: 5 };
}

function sortableItemsLocator(page: Page): Locator {
  return page.locator('[role="button"][aria-roledescription="sortable"]');
}

test.describe('Topic selection constraints', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  test('blocks submission when fewer than five items are selected', async ({ page }) => {
    await setupTopicSelection(page, 'Topic QA Host');

    const submitButton = page.getByRole('button', { name: /submit selection/i });
    await expect(submitButton).toHaveCount(0);

    await selectItems(page, FALLBACK_TOPIC_ITEMS.slice(0, 4));
    const { selected } = await readSelectionCount(page);
    expect(selected).toBe(4);
    await expect(submitButton).toHaveCount(0);
  });

  test('prevents selecting more than five items even with rapid clicks', async ({ page }) => {
    await setupTopicSelection(page, 'Topic QA Host 2');

    await selectItems(page, FALLBACK_TOPIC_ITEMS.slice(0, 5));
    await expect(sortableItemsLocator(page)).toHaveCount(5, { timeout: 10_000 });
    const submitButton = page.getByRole('button', { name: /submit selection/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 15_000 });
    await expect(submitButton).toBeEnabled();

    await Promise.all(
      FALLBACK_TOPIC_ITEMS.slice(5).map(async (name) => {
        const option = page.getByRole('button', { name }).first();
        if ((await option.count()) > 0) {
          await option.click();
        }
      })
    );

    const { selected } = await readSelectionCount(page);
    expect(selected).toBe(5);
    await expect(sortableItemsLocator(page)).toHaveCount(5);
    await expect(submitButton).toBeEnabled();
  });

  test('surface server rejection and preserve selection state after a failed submission', async ({ page }) => {
    await setupTopicSelection(page, 'Topic QA Host 3');
    const rejectionRoute = '**/rest/v1/player_selections*';
    const rejectedMethods = new Set(['POST', 'PATCH']);

    const handle = async (route: Route, request: Request) => {
      if (rejectedMethods.has(request.method())) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid item selection payload' })
        });
      } else {
        await route.continue();
      }
    };

    await page.route(rejectionRoute, handle);

    try {
      await selectItems(page, FALLBACK_TOPIC_ITEMS.slice(0, 5));
      const submitButton = page.getByRole('button', { name: /submit selection/i }).first();
      await expect(submitButton).toBeEnabled({ timeout: 15_000 });
      await submitButton.click();

      const rejectionToast = page.getByRole('status').filter({ hasText: /Unable to submit selection/i }).first();
      await expect(rejectionToast).toBeVisible({ timeout: 30_000 });
      await expect(submitButton).toBeEnabled({ timeout: 10_000 });

      const { selected } = await readSelectionCount(page);
      expect(selected).toBe(5);
      await expect(sortableItemsLocator(page)).toHaveCount(5);
    } finally {
      await page.unroute(rejectionRoute, handle).catch(() => {});
    }
  });
});