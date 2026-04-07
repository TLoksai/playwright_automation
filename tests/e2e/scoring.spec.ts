import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TOPIC_TITLE = 'Most Adorable Pet';
const DEFAULT_CARD_OPTIONS = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds', 'Fish', 'Turtles', 'Lizards'];
const ROUND_RESULT_TIMEOUT = 180_000;

const slugify = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');
const normalizeItemLabel = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function calculateRoundScore(actual: string[], guess: string[]) {
  if (!actual.length || !guess.length) {
    throw new Error('Actual and guess arrays must be populated before scoring.');
  }

  let matches = 0;
  let points = 0;

  for (let index = 0; index < Math.min(actual.length, guess.length); index += 1) {
    if (actual[index] === guess[index]) {
      matches += 1;
      points += index === 0 || index === actual.length - 1 ? 2 : 1;
    }
  }

  if (matches === 0) {
    return -1;
  }

  if (matches === actual.length) {
    return points + 3;
  }

  return points;
}

async function openPlayScreen(page: Page, playerName: string) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const playNowLink = page.getByRole('link', { name: /play now/i }).first();
  const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();

  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else if (await startPlayingButton.isVisible().catch(() => false)) {
    await startPlayingButton.click();
  } else {
    throw new Error('Unable to find entry point for Play flow.');
  }

  const nameInputs = page.getByRole('textbox', { name: /enter your name/i });
  await expect(nameInputs.first()).toBeVisible({ timeout: 60_000 });
  await nameInputs.first().fill(playerName);
}

async function waitForHostLobbyState(page: Page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? '';
      if (/Players\s*\(\d+\/\d+\)/i.test(text)) return true;
      if (/Waiting for Players/i.test(text)) return true;
      if (document.querySelector('[data-testid="add-ai-player-btn"]')) return true;
      if (document.querySelector('[data-testid="start-game-btn"]')) return true;
      return false;
    },
    { timeout: timeoutMs }
  );
}

async function waitForJoinerLobbyState(page: Page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? '';
      if (/Waiting for Players/i.test(text)) return true;
      if (/Waiting for host/i.test(text)) return true;
      if (/Round\s+\d+/i.test(text)) return true;
      if (/Topic Selection/i.test(text)) return true;
      return false;
    },
    { timeout: timeoutMs }
  );
}

async function createRoomAndReturnCode(page: Page, hostName: string) {
  await openPlayScreen(page, hostName);
  const createButton = page.getByRole('button', { name: /create game room/i }).first();
  await expect(createButton).toBeEnabled({ timeout: 60_000 });

  let lobbyReady = false;
  for (let attempt = 0; attempt < 3 && !lobbyReady; attempt += 1) {
    await createButton.click();
    lobbyReady = await waitForHostLobbyState(page, 90_000).then(
      () => true,
      () => false
    );
    if (!lobbyReady) {
      await page.waitForTimeout(2_000);
    }
  }
  if (!lobbyReady) {
    throw new Error('Unable to reach game lobby after creating room.');
  }

  const roomCodeLocator = page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first();
  await expect(roomCodeLocator).toBeVisible({ timeout: 60_000 });
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code not rendered after creating room.');
  }
  return roomCode;
}

async function joinRoomAsPlayer(page: Page, joinerName: string, roomCode: string) {
  await openPlayScreen(page, joinerName);
  const nameInputs = page.getByRole('textbox', { name: /enter your name/i });
  await expect(nameInputs.nth(1)).toBeVisible({ timeout: 30_000 });
  await nameInputs.nth(1).fill(joinerName);
  await page.getByRole('textbox', { name: /e\.g\.,/i }).fill(roomCode);
  const joinButton = page.getByRole('button', { name: /join game room/i }).first();
  await expect(joinButton).toBeEnabled();

  let joined = false;
  for (let attempt = 0; attempt < 3 && !joined; attempt += 1) {
    await joinButton.click();
    joined = await waitForJoinerLobbyState(page, 90_000).then(
      () => true,
      () => false
    );
    if (!joined) {
      await page.waitForTimeout(2_000);
    }
  }
  if (!joined) {
    throw new Error('Unable to join lobby after submitting join form.');
  }
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
  await page.mouse.move(catsBox.x + catsBox.width / 2, catsBox.y + catsBox.height / 2, { steps: 25 });
  await page.mouse.up();
}

async function trySubmitSelectionIfReady(page: Page): Promise<boolean> {
  const submitSelection = page.getByRole('button', { name: /submit selection/i }).first();
  const submitGuess = page.getByRole('button', { name: /submit guess/i }).first();
  if ((await submitGuess.count()) > 0) {
    return false;
  }

  const topicButton = page.getByRole('button', { name: TOPIC_TITLE }).first();
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  const hasOrderedItems = (await orderedItems.count()) > 0 && (await orderedItems.first().isVisible().catch(() => false));

  if (!hasOrderedItems && (await topicButton.count()) > 0 && (await topicButton.isEnabled().catch(() => false))) {
    await topicButton.click();
    await page.waitForTimeout(500);
    for (const item of DEFAULT_CARD_OPTIONS) {
      const option = page.getByRole('button', { name: item }).first();
      if ((await option.count()) > 0 && (await option.isEnabled().catch(() => false))) {
        await option.click();
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(800);
  }

  let isSortable = false;
  try {
    await page.waitForFunction(
      () => document.querySelector('[role="button"][aria-roledescription="sortable"]') !== null,
      { timeout: 5_000 }
    );
    isSortable = true;
  } catch {
    isSortable = false;
  }

  if (isSortable && (await orderedItems.count()) > 0) {
    await reorderBunniesAndCats(page, orderedItems);
  }

  if ((await submitSelection.count()) > 0 && (await submitSelection.isVisible()) && (await submitSelection.isEnabled())) {
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

async function isGameOverScreen(page: Page) {
  const heading = page.getByRole('heading', { name: /game over/i });
  return (await heading.count()) > 0 && (await heading.isVisible().catch(() => false));
}

async function clickContinueWhenReady(pages: Page | Page[], maxWaitMs = 180_000) {
  const candidates = Array.isArray(pages) ? pages : [pages];
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const candidate of candidates) {
      if (await isGameOverScreen(candidate)) {
        return candidate;
      }
      const buttons = [
        candidate.getByRole('button', { name: /next vip!?/i }).first(),
        candidate.getByRole('button', { name: /continue.*round/i }).first(),
        candidate.getByRole('button', { name: /next round/i }).first(),
        candidate.getByRole('button', { name: /continue/i }).first(),
        candidate.getByRole('button', { name: /start next/i }).first(),
      ];
      for (const button of buttons) {
        if ((await button.count()) > 0 && (await button.isVisible()) && (await button.isEnabled())) {
          await button.click();
          return candidate;
        }
      }
    }
    await candidates[0].waitForTimeout(1_000);
  }
  throw new Error('Unable to progress to the next phase.');
}

async function waitForGuessingPage(hostPage: Page, joinerPage: Page, maxWaitMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const candidate of [hostPage, joinerPage]) {
      const submitGuess = candidate.getByRole('button', { name: /submit guess/i }).first();
      const orderedItems = candidate.locator('[role="button"][aria-roledescription="sortable"]');
      if (
        (await submitGuess.count()) > 0 &&
        (await submitGuess.isVisible()) &&
        (await orderedItems.count()) > 0 &&
        (await orderedItems.first().isVisible())
      ) {
        return candidate;
      }
    }
    await hostPage.waitForTimeout(1_000);
  }
  throw new Error('Guessing phase did not start in time.');
}

function getOppositePage(candidate: Page, hostPage: Page, joinerPage: Page) {
  return candidate === hostPage ? joinerPage : hostPage;
}

async function ensureGuessingPlayerPage(candidate: Page, hostPage: Page, joinerPage: Page) {
  const main = candidate.getByRole('main');
  if ((await main.count()) > 0) {
    const text = await main.innerText().catch(() => '');
    if (!/you are the vip/i.test(text)) {
      return candidate;
    }
  }

  const alternate = getOppositePage(candidate, hostPage, joinerPage);
  const alternateMain = alternate.getByRole('main');
  if ((await alternateMain.count()) > 0) {
    const text = await alternateMain.innerText().catch(() => '');
    if (!/you are the vip/i.test(text)) {
      return alternate;
    }
  }

  return candidate;
}

async function submitGuessAndCaptureOrder(page: Page) {
  await expect(page.getByRole('main')).toContainText(/submit guess/i, { timeout: 120_000 });
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  await expect(orderedItems.first()).toBeVisible({ timeout: 120_000 });
  await reorderBunniesAndCats(page, orderedItems);

  const orderBeforeSubmit = (await orderedItems.allTextContents()).map((text) => text.trim()).filter(Boolean);

  await page.getByRole('button', { name: /submit guess/i }).click();
  return orderBeforeSubmit;
}

async function expectPostGuessProgress(page: Page) {
  const main = page.getByRole('main');
  await expect(main).toContainText(
    /guess submitted|round results|actual order|waiting for host|ready to play|continue/i,
    { timeout: 120_000 }
  );
}

async function waitForScoringPhase(page: Page) {
  await expect(page.getByRole('heading', { name: /round results/i })).toBeVisible({ timeout: ROUND_RESULT_TIMEOUT });
  await expect(page.getByRole('heading', { name: /current standings/i })).toBeVisible({
    timeout: ROUND_RESULT_TIMEOUT,
  });
}

function extractPoints(raw: string) {
  const match = raw.match(/-?\d+(?=[^0-9]*pts)/i) ?? raw.match(/-?\d+/);
  if (!match) {
    throw new Error(`Unable to parse score text "${raw}"`);
  }
  return Number(match[0]);
}

async function readStandingScore(page: Page, playerName: string) {
  const slug = slugify(playerName);
  const scoreLocator = page.getByTestId(`standing-score-${slug}`);
  await expect(scoreLocator).toBeVisible({ timeout: 30_000 });
  const raw = (await scoreLocator.innerText()).trim();
  return extractPoints(raw);
}

async function readRoundPoints(page: Page, playerName: string) {
  const slug = slugify(playerName);
  const scoreLocator = page.getByTestId(`score-${slug}`);
  await expect(scoreLocator).toBeVisible({ timeout: 30_000 });
  const raw = (await scoreLocator.innerText()).trim();
  return extractPoints(raw);
}

async function expectLeaderboardVisible(page: Page, playerNames: string[]) {
  await expect(page.getByRole('heading', { name: /current standings/i })).toBeVisible({ timeout: 30_000 });
  for (const player of playerNames) {
    const slug = slugify(player);
    await expect(page.getByTestId(`standing-${slug}`)).toBeVisible({ timeout: 30_000 });
  }
}

async function readActualOrder(page: Page) {
  const heading = page.getByRole('heading', { name: /actual order/i }).first();
  await heading.waitFor({ state: 'visible', timeout: ROUND_RESULT_TIMEOUT });
  const items = await heading.evaluate((node) => {
    const collectNames = () => {
      let wrapper: HTMLElement | null = node.parentElement;
      while (wrapper && wrapper.tagName !== 'DIV') {
        wrapper = wrapper.parentElement;
      }
      const container = wrapper?.nextElementSibling;
      const rowElements = Array.from(container?.querySelectorAll('div') ?? []);
      const names: string[] = [];
      for (const row of rowElements) {
        const text = (row.textContent || '').trim();
        if (!/^\d+\./.test(text)) {
          continue;
        }
        const nameEl = row.querySelector('.font-body');
        const name = nameEl?.textContent?.trim();
        if (name) {
          names.push(name);
        }
        if (names.length === 5) {
          break;
        }
      }
      return names;
    };
    return collectNames();
  });
  if (!items.length) {
    throw new Error('Actual order names were not rendered.');
  }
  return items;
}

test.describe('VIP reveal scoring visibility', () => {
  test.setTimeout(420_000);

  test('applies scoring weights and updates leaderboard after VIP reveal', async ({ page, browser }) => {
    const hostName = `Score Host ${Date.now()}`;
    const joinerName = `Score Joiner ${Date.now()}`;

    const roomCode = await createRoomAndReturnCode(page, hostName);
    const joinerContext = await browser.newContext();
    const joinerPage = await joinerContext.newPage();

    try {
      await joinRoomAsPlayer(joinerPage, joinerName, roomCode);

      await expect(page.getByRole('heading', { name: /players \(2\/6\)/i })).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('button', { name: /start game/i })).toBeEnabled({ timeout: 60_000 });
      await page.getByRole('button', { name: /start game/i }).click();

      await expect(page.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });
      await expect(joinerPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });

      await waitForSelectionSubmission([page, joinerPage]);
      await waitForSelectionSubmission([page, joinerPage]);

      await clickContinueWhenReady([page, joinerPage]);

      const guessingPage = await waitForGuessingPage(page, joinerPage);
      const activeGuessPage = await ensureGuessingPlayerPage(guessingPage, page, joinerPage);
      const guessOrder = await submitGuessAndCaptureOrder(activeGuessPage);

      await expectPostGuessProgress(page);
      await expectPostGuessProgress(joinerPage);

      await waitForScoringPhase(page);
      await expectLeaderboardVisible(page, [hostName, joinerName]);

      const roundPoints = await readRoundPoints(page, hostName);
      const leaderboardScore = await readStandingScore(page, hostName);
      const actualOrder = (await readActualOrder(page)).map(normalizeItemLabel);
      const normalizedGuess = guessOrder.map(normalizeItemLabel);
      const expectedScore = calculateRoundScore(actualOrder, normalizedGuess);

      expect(roundPoints).toBe(expectedScore);
      expect(leaderboardScore).toBe(expectedScore);

      await expect(page.getByRole('heading', { name: /round results/i }).locator('..')).toContainText(hostName);
      await expect(page.getByRole('heading', { name: /current standings/i }).locator('..')).toContainText(
        hostName
      );
    } finally {
      await joinerContext.close();
    }
  });
});
