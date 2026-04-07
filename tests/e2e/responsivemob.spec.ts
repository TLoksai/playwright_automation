import { test, expect, devices, type Browser, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TOPIC_TITLE = 'Most Adorable Pet';
const DEFAULT_CARD_OPTIONS = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds', 'Fish', 'Turtles', 'Lizards'];
const CTA_MIN_HEIGHT_PX = 48;
const CTA_EDGE_SAFE_AREA_PX = 8;
const CTA_FULL_WIDTH_RATIO = 0.95;

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 640 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile', viewport: devices['Pixel 5'].viewport },
  { name: 'mobile-large', viewport: { width: 430, height: 932 } },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 } },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'desktop-wide', viewport: { width: 1440, height: 900 } },
];

const thumbFriendlyBreakpoints = breakpoints.filter((breakpoint) => breakpoint.viewport.width <= 375);

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function openPlayScreen(page: Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const playNowLink = page.getByRole('link', { name: /play now/i }).first();
  const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();

  if (await isVisible(playNowLink)) {
    await playNowLink.click();
  } else if (await isVisible(startPlayingButton)) {
    await startPlayingButton.click();
  } else {
    throw new Error('Unable to locate Play Now or Start Playing controls.');
  }

  await expect(page.getByPlaceholder('Enter your name').first()).toBeVisible({ timeout: 60_000 });
}

async function fillInputReliably(locator: Locator, value: string) {
  await locator.click();
  await locator.clear().catch(() => undefined);
  await locator.fill('');
  await locator.type(value, { delay: 30 }).catch(async () => {
    await locator.fill(value);
  });
}

async function submitAction(page: Page, button: Locator, input: Locator) {
  await button.scrollIntoViewIfNeeded().catch(() => undefined);
  await button.click().catch(async () => {
    await input.press('Enter').catch(() => undefined);
    await button.click({ force: true }).catch(() => undefined);
  });
}

async function createRoomAndReturnCode(page: Page, hostName: string) {
  let navigated = false;
  for (let attempt = 0; attempt < 3 && !navigated; attempt += 1) {
    await openPlayScreen(page);
    const hostInput = page.getByTestId('create-room-name-input').first();
    const createGameButton = page.getByRole('button', { name: /^create game$/i }).first();
    await expect(hostInput).toBeVisible({ timeout: 60_000 });
    await fillInputReliably(hostInput, hostName);
    await expect(createGameButton).toBeEnabled({ timeout: 30_000 });
    await submitAction(page, createGameButton, hostInput);
    try {
      await expect(page).toHaveURL(/\/game\//, { timeout: 60_000 });
      navigated = true;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  if (!navigated) {
    throw new Error('Unable to reach game lobby after creating room.');
  }

  const playersHeading = page.getByRole('heading', { name: /^players/i }).first();
  await expect(playersHeading).toBeVisible({ timeout: 60_000 });
  const roomCodeLocator = page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first();
  await expect(roomCodeLocator).toBeVisible({ timeout: 60_000 });
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code not found after creating room.');
  }
  return roomCode;
}

async function ensureMinimumPlayers(page: Page, requiredCount: number) {
  const playersHeading = page.getByRole('heading', { name: /^players/i }).first();
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
      return;
    }
    await expect(addAiButton).toBeVisible({ timeout: 30_000 });
    await addAiButton.click();
    guard += 1;
    if (guard > 5) {
      throw new Error(`Could not reach ${requiredCount} players via AI helpers.`);
    }
  }
}

async function waitForAnyTopicItem(page: Page) {
  for (const candidate of DEFAULT_CARD_OPTIONS) {
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
    if ((await button.count()) > 0) {
      await button.waitFor({ state: 'visible', timeout: 20_000 });
      await button.click();
      await page.waitForTimeout(100);
    }
  }
}

async function openTopicSelection(page: Page) {
  await expect(page.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });
  const topicButton = page.getByRole('button', { name: TOPIC_TITLE }).first();
  await expect(topicButton).toBeVisible({ timeout: 30_000 });

  const topicItemsResponse = page.waitForResponse(
    (response) => response.url().includes('/rest/v1/topic_items') && response.request().method() === 'GET',
    { timeout: 30_000 }
  ).catch(() => null);

  await topicButton.click();
  await topicItemsResponse;
  await waitForAnyTopicItem(page);
}

async function reorderBunniesAndCats(page: Page, orderedItems: Locator) {
  const bunniesCard = orderedItems.filter({ hasText: 'Bunnies' });
  const catsCard = orderedItems.filter({ hasText: 'Cats' });
  if ((await bunniesCard.count()) === 0 || (await catsCard.count()) === 0) {
    return;
  }

  const bunniesBox = await bunniesCard.first().boundingBox();
  const catsBox = await catsCard.first().boundingBox();
  if (!bunniesBox || !catsBox) {
    return;
  }

  await page.mouse.move(bunniesBox.x + bunniesBox.width / 2, bunniesBox.y + bunniesBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(catsBox.x + catsBox.width / 2, catsBox.y + catsBox.height / 2, { steps: 20 });
  await page.mouse.up();
}

async function prepareSelection(page: Page) {
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  const hasOrderedItems = (await orderedItems.count()) > 0 && (await orderedItems.first().isVisible().catch(() => false));

  if (!hasOrderedItems) {
    await openTopicSelection(page);
    await selectItems(page, DEFAULT_CARD_OPTIONS);
    await page.waitForTimeout(800);
  }

  if ((await orderedItems.count()) > 0) {
    await reorderBunniesAndCats(page, orderedItems);
  }
}

async function trySubmitSelectionIfReady(page: Page): Promise<boolean> {
  const submitSelection = page.getByRole('button', { name: /submit selection/i }).first();
  const submitGuess = page.getByRole('button', { name: /submit guess/i }).first();
  if (await isVisible(submitGuess)) {
    return false;
  }

  await prepareSelection(page);
  if (await isVisible(submitSelection) && (await submitSelection.isEnabled().catch(() => false))) {
    await submitSelection.click();
    return true;
  }

  return false;
}

async function waitForSelectionSubmission(pages: Page | Page[], maxWaitMs = 180_000) {
  const candidates = Array.isArray(pages) ? pages : [pages];
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const candidate of candidates) {
      if (await trySubmitSelectionIfReady(candidate)) {
        return candidate;
      }
    }
    await candidates[0].waitForTimeout(1_000);
  }
  throw new Error('Selection submission did not complete in time.');
}

async function submitGuessAndCaptureOrder(page: Page) {
  await expect(page.getByRole('main')).toContainText(/submit guess/i, { timeout: 120_000 });
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  await expect(orderedItems.first()).toBeVisible({ timeout: 120_000 });
  await reorderBunniesAndCats(page, orderedItems);
  await page.getByRole('button', { name: /submit guess/i }).click();
}

async function waitForNextRoundButton(page: Page, maxWaitMs = 180_000) {
  const candidates = [
    page.getByRole('button', { name: /next round/i }).first(),
    page.getByRole('button', { name: /next vip!?/i }).first(),
    page.getByRole('button', { name: /continue.*round/i }).first(),
    page.getByRole('button', { name: /continue/i }).first(),
  ];

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const button of candidates) {
      if (await isVisible(button) && (await button.isEnabled().catch(() => false))) {
        return button;
      }
    }

    const submitGuess = page.getByRole('button', { name: /submit guess/i }).first();
    if (await isVisible(submitGuess) && (await submitGuess.isEnabled().catch(() => false))) {
      await submitGuessAndCaptureOrder(page);
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error('Next round CTA did not appear in time.');
}

async function setupHostWithAi(browser: Browser, viewport: { width: number; height: number }, hostName: string) {
  const hostContext = await browser.newContext({ viewport });
  const hostPage = await hostContext.newPage();
  await createRoomAndReturnCode(hostPage, hostName);
  await ensureMinimumPlayers(hostPage, 2);
  return { hostContext, hostPage };
}

async function assertPrimaryCtaLayout(page: Page, button: Locator, label: string) {
  await expect(button, `${label} should be visible.`).toBeVisible({ timeout: 60_000 });
  await button.scrollIntoViewIfNeeded().catch(() => undefined);

  const metrics = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const parentRect = element.parentElement?.getBoundingClientRect() ?? rect;
    return {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      rightInset: window.innerWidth - rect.right,
      parentWidth: parentRect.width,
    };
  });

  expect(metrics.height, `${label} should be at least 48px tall.`).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);
  expect(metrics.left, `${label} should not sit against the left screen edge.`).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);
  expect(metrics.rightInset, `${label} should not sit against the right screen edge.`).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);
  expect(metrics.width / metrics.parentWidth, `${label} should fill its container on mobile.`).toBeGreaterThanOrEqual(CTA_FULL_WIDTH_RATIO);
}

async function assertPrimaryCtasStackVertically(page: Page) {
  const metrics = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button'))
      .filter((button) => {
        const text = (button.textContent ?? '').trim();
        if (!/lock in|submit selection|start game|next round|next vip|continue.*round/i.test(text)) {
          return false;
        }
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((button) => {
        const text = (button.textContent ?? '').trim();
        const rect = button.getBoundingClientRect();
        return { text, top: rect.top, bottom: rect.bottom };
      });

    for (let index = 0; index < candidates.length - 1; index += 1) {
      const current = candidates[index];
      const next = candidates[index + 1];
      if (Math.abs(current.top - next.top) < 12 && Math.abs(current.bottom - next.bottom) < 12) {
        return { stacked: false, current: current.text, next: next.text };
      }
    }

    return { stacked: true, current: '', next: '' };
  });

  expect(metrics.stacked, `Primary CTAs should not appear side-by-side on mobile. Offending pair: ${metrics.current} / ${metrics.next}`).toBeTruthy();
}

test.describe('Mobile gameplay CTA responsiveness', () => {
  test.describe.configure({ timeout: 420_000 });

  for (const breakpoint of thumbFriendlyBreakpoints) {
    test(`primary gameplay CTAs are thumb-friendly on ${breakpoint.name}`, async ({ browser }) => {
      const { hostContext, hostPage } = await setupHostWithAi(
        browser,
        breakpoint.viewport,
        `Host ${breakpoint.name} ${Date.now()}`
      );

      try {
        const startGameButton = hostPage.getByRole('button', { name: /start game/i }).first();
        await assertPrimaryCtaLayout(hostPage, startGameButton, 'Start Game');
        await assertPrimaryCtasStackVertically(hostPage);
        await startGameButton.click();

        await prepareSelection(hostPage);

        const lockInButton = hostPage.getByRole('button', { name: /lock in|submit selection/i }).first();
        await expect(lockInButton).toBeVisible({ timeout: 30_000 });
        await assertPrimaryCtaLayout(hostPage, lockInButton, 'Lock In');
        await assertPrimaryCtasStackVertically(hostPage);

        await lockInButton.click();
        const nextRoundButton = await waitForNextRoundButton(hostPage);
        await assertPrimaryCtaLayout(hostPage, nextRoundButton, 'Next Round');
        await assertPrimaryCtasStackVertically(hostPage);
      } finally {
        await hostContext.close().catch(() => {});
      }
    });
  }
});
