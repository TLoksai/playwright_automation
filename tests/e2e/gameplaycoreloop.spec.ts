import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TOPIC_TITLE = 'Most Adorable Pet';
const DEFAULT_CARD_OPTIONS = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds'];
const HOST_EXIT_WAIT_MS = 70_000;

async function isVisible(locator: Locator): Promise<boolean> {
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
  }

  await expect(page.getByPlaceholder('Enter your name').first()).toBeVisible({ timeout: 60_000 });
}

async function fillInputReliably(locator: Locator, value: string) {
  await locator.click();
  await locator.clear().catch(() => undefined);
  await locator.fill('');
  await locator.type(value, { delay: 40 }).catch(async () => {
    await locator.fill(value);
  });
  await locator.blur().catch(() => undefined);
}

async function submitAction(page: Page, button: Locator, input: Locator) {
  await button.scrollIntoViewIfNeeded().catch(() => undefined);
  const testId = await button.getAttribute('data-testid');

  const attempts: Array<() => Promise<void>> = [
    () => button.click(),
    () => button.click({ force: true }),
    () => input.press('Enter'),
    () =>
      button.evaluate((element: HTMLButtonElement) => {
        element.click();
      }),
    () =>
      page.evaluate((buttonTestId) => {
        if (!buttonTestId) return;
        const target = document.querySelector<HTMLButtonElement>(`[data-testid="${buttonTestId}"]`);
        target?.click();
      }, testId),
  ];

  for (const attempt of attempts) {
    await attempt().catch(() => undefined);
    await page.waitForTimeout(500);
  }
}

function getCreateGameControls(page: Page) {
  const createSection = page.getByRole('heading', { name: /create game/i }).first().locator('..').locator('..');
  const nameInput = createSection.getByPlaceholder('Enter your name').first();
  const createButton = createSection.getByRole('button', { name: /create game room|create game/i }).first();
  return { nameInput, createButton };
}

function getJoinGameControls(page: Page) {
  const joinSection = page.getByRole('heading', { name: /join game/i }).first().locator('..').locator('..');
  const nameInput = joinSection.getByPlaceholder('Enter your name').first();
  const roomCodeInput = joinSection.getByPlaceholder(/e\.g\.,?\s*Success5Win3/i).first();
  const joinButton = joinSection.getByRole('button', { name: /join game room|join game|join room/i }).first();
  return { nameInput, roomCodeInput, joinButton };
}

async function waitForHostLobbyState(page: Page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () =>
      /Players\s*\(\d+\/\d+\)/i.test(document.body?.innerText ?? '') ||
      /Waiting for Players/i.test(document.body?.innerText ?? '') ||
      !!document.querySelector('[data-testid="add-ai-player-btn"]') ||
      !!document.querySelector('[data-testid="start-game-btn"]'),
    { timeout: timeoutMs }
  );
}

async function waitForJoinerLobbyState(page: Page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () =>
      /Waiting for Players/i.test(document.body?.innerText ?? '') ||
      /Waiting for host/i.test(document.body?.innerText ?? '') ||
      /Round\s+\d+/i.test(document.body?.innerText ?? '') ||
      /Topic Selection/i.test(document.body?.innerText ?? ''),
    { timeout: timeoutMs }
  );
}

async function createRoomAndReturnCode(page: Page, hostName: string) {
  await openPlayScreen(page);
  const { nameInput, createButton } = getCreateGameControls(page);
  await fillInputReliably(nameInput, hostName);
  await expect(createButton).toBeEnabled({ timeout: 30_000 });

  let lobbyReady = false;
  for (let attempt = 0; attempt < 3 && !lobbyReady; attempt += 1) {
    await submitAction(page, createButton, nameInput);
    lobbyReady = await waitForHostLobbyState(page, 30_000).then(
      () => true,
      () => false
    );
    if (!lobbyReady) {
      await page.waitForTimeout(2_000);
      await openPlayScreen(page);
      await fillInputReliably(getCreateGameControls(page).nameInput, hostName);
    }
  }

  if (!lobbyReady) {
    throw new Error('Unable to reach game lobby after creating room.');
  }

  const roomCodeLocator = page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first();
  await expect(roomCodeLocator).toBeVisible({ timeout: 60_000 });
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code not found after creating room.');
  }
  return roomCode;
}

async function joinRoomAsPlayer(page: Page, joinerName: string, roomCode: string) {
  await openPlayScreen(page);
  const { nameInput, roomCodeInput, joinButton } = getJoinGameControls(page);
  await fillInputReliably(nameInput, joinerName);
  await fillInputReliably(roomCodeInput, roomCode);
  await expect(joinButton).toBeEnabled({ timeout: 30_000 });

  let joined = false;
  for (let attempt = 0; attempt < 3 && !joined; attempt += 1) {
    await submitAction(page, joinButton, roomCodeInput);
    joined = await waitForJoinerLobbyState(page, 30_000).then(
      () => true,
      () => false
    );
    if (!joined) {
      await page.waitForTimeout(2_000);
      await openPlayScreen(page);
      const controls = getJoinGameControls(page);
      await fillInputReliably(controls.nameInput, joinerName);
      await fillInputReliably(controls.roomCodeInput, roomCode);
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
  if (await isVisible(submitGuess)) {
    return false;
  }

  const topicButton = page.getByRole('button', { name: TOPIC_TITLE }).first();
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  const hasOrderedItems = (await orderedItems.count()) > 0 && (await orderedItems.first().isVisible().catch(() => false));

  if (!hasOrderedItems && await isVisible(topicButton)) {
    await topicButton.click();
    await page.waitForTimeout(500);
    for (const item of DEFAULT_CARD_OPTIONS) {
      const option = page.getByRole('button', { name: item }).first();
      if (await isVisible(option)) {
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

async function clickContinueWhenReady(pages: Page | Page[], maxWaitMs = 180_000) {
  const candidates = Array.isArray(pages) ? pages : [pages];
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const candidate of candidates) {
      const buttons = [
        candidate.getByRole('button', { name: /next vip!?/i }).first(),
        candidate.getByRole('button', { name: /continue.*round/i }).first(),
        candidate.getByRole('button', { name: /next round/i }).first(),
        candidate.getByRole('button', { name: /continue/i }).first(),
        candidate.getByRole('button', { name: /start next/i }).first(),
      ];
      for (const button of buttons) {
        if (await isVisible(button) && (await button.isEnabled().catch(() => false))) {
          await button.click();
          return candidate;
        }
      }
    }
    await candidates[0].waitForTimeout(1_000);
  }
  throw new Error('Unable to progress to the next phase.');
}

async function pageHasVipNotice(page: Page) {
  const main = page.getByRole('main');
  if ((await main.count()) === 0) return false;
  const text = (await main.innerText().catch(() => '')) ?? '';
  return /you are the vip/i.test(text);
}

function getOppositePage(candidate: Page, hostPage: Page, joinerPage: Page) {
  return candidate === hostPage ? joinerPage : hostPage;
}

async function ensureGuessingPlayerPage(candidate: Page, hostPage: Page, joinerPage: Page) {
  if (!(await pageHasVipNotice(candidate))) {
    return candidate;
  }

  const alternate = getOppositePage(candidate, hostPage, joinerPage);
  if (!(await pageHasVipNotice(alternate))) {
    return alternate;
  }

  return candidate;
}

async function waitForGuessingPage(hostPage: Page, joinerPage: Page, maxWaitMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const candidate of [hostPage, joinerPage]) {
      const submitGuess = candidate.getByRole('button', { name: /submit guess/i }).first();
      const orderedItems = candidate.locator('[role="button"][aria-roledescription="sortable"]');
      if (
        await isVisible(submitGuess) &&
        (await orderedItems.count()) > 0 &&
        (await orderedItems.first().isVisible().catch(() => false))
      ) {
        return candidate;
      }
    }
    await hostPage.waitForTimeout(1_000);
  }
  throw new Error('Guessing phase did not start in time.');
}

async function submitGuessAndCaptureOrder(page: Page) {
  await expect(page.getByRole('main')).toContainText(/submit guess/i, { timeout: 120_000 });
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  await expect(orderedItems.first()).toBeVisible({ timeout: 120_000 });
  await reorderBunniesAndCats(page, orderedItems);
  await page.getByRole('button', { name: /submit guess/i }).click();
}

async function expectPostGuessProgress(page: Page) {
  const main = page.getByRole('main');
  try {
    await expect(main).toContainText(
      /guess submitted|round results|actual order|waiting for host|ready to play|continue/i,
      { timeout: 120_000 }
    );
  } catch (error) {
    const text = (await main.innerText().catch(() => '')) ?? '';
    const vipWaitingPattern = /you are the vip/i.test(text) && /waiting for .*player/i.test(text);
    if (!vipWaitingPattern) throw error;
  }
}

async function waitForScoringPhase(page: Page) {
  await expect(page.getByRole('heading', { name: /round results/i })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole('heading', { name: /current standings/i })).toBeVisible({ timeout: 180_000 });
}

async function playRoundToScoring(hostPage: Page, joinerPage: Page) {
  await waitForSelectionSubmission([hostPage, joinerPage]);
  await waitForSelectionSubmission([hostPage, joinerPage]);

  await clickContinueWhenReady([hostPage, joinerPage], 20_000).catch(() => undefined);

  const guessingPage = await waitForGuessingPage(hostPage, joinerPage);
  const activeGuessPage = await ensureGuessingPlayerPage(guessingPage, hostPage, joinerPage);
  await submitGuessAndCaptureOrder(activeGuessPage);

  await expectPostGuessProgress(hostPage);
  await expectPostGuessProgress(joinerPage);
  await waitForScoringPhase(hostPage);
}

async function startGame(hostPage: Page) {
  const startButton = hostPage.getByRole('button', { name: /start game/i }).first();
  await expect(startButton).toBeEnabled({ timeout: 60_000 });
  await startButton.click();

  await expect(hostPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });
  await expect(hostPage.getByRole('heading', { name: /round 1/i })).toBeVisible({ timeout: 90_000 });
}

async function setupHostAndJoiner(browser: Browser, hostName: string, joinerName: string) {
  const hostContext = await browser.newContext();
  const hostPage = await hostContext.newPage();

  const roomCode = await createRoomAndReturnCode(hostPage, hostName);
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await joinRoomAsPlayer(joinerPage, joinerName, roomCode);

  return { hostContext, hostPage, joinerContext, joinerPage };
}

async function expectNoBlankOrErrorState(page: Page) {
  const main = page.getByRole('main');
  await expect(main).toBeVisible({ timeout: 30_000 });
  const text = (await main.innerText().catch(() => '')) ?? '';

  expect(text.trim().length).toBeGreaterThan(0);
  expect(text).not.toMatch(/something went wrong|application error|unexpected error|undefined|null/i);
}

async function expectHomeScreen(page: Page, maxWaitMs = 15_000) {
  const controls = [
    page.getByRole('link', { name: /play now/i }).first(),
    page.getByRole('button', { name: /start playing/i }).first(),
    page.getByRole('button', { name: /join game room|join game/i }).first(),
    page.getByRole('button', { name: /create game room|create game/i }).first(),
  ];

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const control of controls) {
      if (await isVisible(control)) {
        return;
      }
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Home screen controls did not appear in time.');
}

async function isHomeScreenVisible(page: Page) {
  const controls = [
    page.getByRole('link', { name: /play now/i }).first(),
    page.getByRole('button', { name: /start playing/i }).first(),
    page.getByRole('button', { name: /join game room|join game/i }).first(),
    page.getByRole('button', { name: /create game room|create game/i }).first(),
  ];

  for (const control of controls) {
    if (await isVisible(control)) {
      return true;
    }
  }

  return false;
}

async function resolveHostExitOutcome(page: Page, maxWaitMs = HOST_EXIT_WAIT_MS): Promise<'continued' | 'ended'> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isVisible(page.getByRole('heading', { name: /topic selection/i }).first())) {
      return 'continued';
    }

    if (await isHomeScreenVisible(page)) {
      return 'ended';
    }

    const main = page.getByRole('main');
    const text = ((await main.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ');
    if (/game ended|host left|player left/i.test(text)) {
      return 'ended';
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error('Host exit did not result in reassignment or a clean end state in time.');
}

async function assertEndedFlow(page: Page) {
  const alreadyHome = await isHomeScreenVisible(page);
  if (!alreadyHome) {
    await expect(page.getByRole('main')).toContainText(/game ended|host left|player left/i, { timeout: 15_000 });
    await expectNoBlankOrErrorState(page);
  }

  const dismissCandidates = [
    page.getByTestId('back-to-lobby-btn').first(),
    page.getByRole('button', { name: /back to lobby|dismiss|ok/i }).first(),
  ];

  let dismissClicked = false;
  for (const candidate of dismissCandidates) {
    if (await isVisible(candidate)) {
      await candidate.click().catch(() => undefined);
      dismissClicked = true;
      break;
    }
  }

  if (!alreadyHome) {
    await expectHomeScreen(page, dismissClicked ? 15_000 : 7_000);
  }

  await expectHomeScreen(page, 5_000);
  await expect(page.getByRole('main')).not.toContainText(
    /round 1|topic selection|submit selection|submit guess|please select a topic from above/i
  );
  await expectNoBlankOrErrorState(page);
}

test.describe('host departure handling', () => {
  test.describe.configure({ timeout: 420_000 });

  test('game either continues under reassigned host or ends cleanly when the host leaves', async ({ browser }) => {
    const { hostContext, hostPage, joinerContext, joinerPage } = await setupHostAndJoiner(
      browser,
      `Host ${Date.now()}`,
      `Joiner ${Date.now()}`
    );

    try {
      await startGame(hostPage);
      await expect(joinerPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });

      await hostContext.close();
      await joinerPage.waitForTimeout(5_000);

      const outcome = await resolveHostExitOutcome(joinerPage);
      if (outcome === 'continued') {
        await expect(joinerPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({
          timeout: 15_000,
        });
        await expectNoBlankOrErrorState(joinerPage);
        await expect(joinerPage.getByRole('main')).not.toContainText(/game ended|host left/i);
      } else {
        await assertEndedFlow(joinerPage);
      }
    } finally {
      await joinerContext.close().catch(() => {});
    }
  });
});
