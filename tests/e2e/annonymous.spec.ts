import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, open, unlink } from 'fs/promises';
import { join } from 'path';

const APP_URL = 'https://knowsy.game/';
const PLAY_URL = new URL('play', APP_URL).toString();
const EXPIRED_ROOM_CODE = 'EXPIRED123PLAY';
const LOCK_DIR = join(process.cwd(), '.playwright-locks');
const ANONYMOUS_LOCK_PATH = join(LOCK_DIR, 'annonymous-room.lock');

async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count().catch(() => 0)) > 0 && (await locator.first().isVisible().catch(() => false));
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
    const clicked = await attempt()
      .then(() => true)
      .catch(() => false);
    if (clicked) {
      return;
    }
    await page.waitForTimeout(300).catch(() => undefined);
  }
}

async function clickButtonReliably(button: Locator) {
  const attempts: Array<() => Promise<void>> = [
    () => button.click(),
    () => button.click({ force: true }),
    () =>
      button.evaluate((element: HTMLButtonElement) => {
        element.click();
      }),
  ];

  for (const attempt of attempts) {
    const clicked = await attempt()
      .then(() => true)
      .catch(() => false);
    if (clicked) {
      return;
    }
  }
}

async function preferTestId(locator: Locator, fallback: () => Locator): Promise<Locator> {
  return (await locator.count()) > 0 ? locator.first() : fallback();
}

async function acquireLock(lockPath: string, timeoutMs = 600_000) {
  await mkdir(LOCK_DIR, { recursive: true });
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const handle = await open(lockPath, 'wx').catch(() => null);
    if (handle) {
      await handle.close();
      return async () => {
        await unlink(lockPath).catch(() => undefined);
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for lock: ${lockPath}`);
}

async function openPlayScreen(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const firstNameInput = await preferTestId(
      page.getByTestId('create-room-name-input'),
      () => page.getByPlaceholder('Enter your name').first()
    );
    const openDirectly = await page
      .goto(PLAY_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 })
      .then(() => true)
      .catch(() => false);

    if (openDirectly) {
      await page.waitForLoadState('networkidle').catch(() => undefined);
      if (await isVisible(firstNameInput)) {
        return;
      }
    }

    const openedHome = await page
      .goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    if (!openedHome) {
      continue;
    }

    await page.waitForLoadState('networkidle').catch(() => undefined);

    const playNowLink = page.getByRole('link', { name: /play now|start play/i }).first();
    const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();
    const playNowButton = page.getByTestId('play-now-btn').first();

    if (await isVisible(playNowLink)) {
      await playNowLink.click().catch(() => undefined);
    } else if (await isVisible(startPlayingButton)) {
      await startPlayingButton.click().catch(() => undefined);
    } else if (await isVisible(playNowButton)) {
      await playNowButton.click().catch(() => undefined);
    } else {
      continue;
    }

    const inputVisible = await firstNameInput.waitFor({ state: 'visible', timeout: 15_000 }).then(
      () => true,
      () => false
    );
    if (inputVisible) {
      return;
    }
  }

  throw new Error('Unable to open the play experience.');
}

async function waitForHostLobbyState(page: Page, timeoutMs = 90_000) {
  await expect
    .poll(
      async () => ((await page.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
      { timeout: timeoutMs }
    )
    .toMatch(/Players\s*\(\d+\/\d+\)|Waiting for Players|Start Game|Add AI Player/i);
}

async function waitForJoinerLobbyState(page: Page, timeoutMs = 90_000) {
  await expect
    .poll(
      async () => ((await page.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
      { timeout: timeoutMs }
    )
    .toMatch(/Waiting for Players|Waiting for host|Round\s+\d+|Topic Selection|minimum 2 players/i);
}

function roomCodeFromUrl(page: Page): string {
  const match = page.url().match(/\/game\/([^/?#]+)/i);
  if (!match) {
    throw new Error(`Room code not found in URL: ${page.url()}`);
  }
  return decodeURIComponent(match[1]);
}

async function createRoom(page: Page, playerName: string): Promise<string> {
  let roomReady = false;

  for (let attempt = 0; attempt < 8 && !roomReady; attempt += 1) {
    await openPlayScreen(page);
    const nameInput = await preferTestId(
      page.getByTestId('create-room-name-input'),
      () => page.getByPlaceholder('Enter your name').first()
    );
    const createRoomButton = await preferTestId(
      page.getByTestId('create-room-submit'),
      () => page.getByRole('button', { name: /create game room|create game/i }).first()
    );

    await fillInputReliably(nameInput, playerName);
    await expect(createRoomButton).toBeEnabled({ timeout: 15_000 });
    await nameInput.press('Enter').catch(() => undefined);

    roomReady = await page
      .waitForURL(/\/game\/[^/?#]+$/i, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (!roomReady) {
      await submitAction(page, createRoomButton, nameInput);
      roomReady = await page
        .waitForURL(/\/game\/[^/?#]+$/i, { timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
    }
  }

  if (!roomReady) {
    throw new Error('Unable to create a room for the guest refresh scenario.');
  }

  await waitForHostLobbyState(page);
  return roomCodeFromUrl(page);
}

async function startGameFromLobby(hostPage: Page, guestPage: Page) {
  const startButton = hostPage.getByRole('button', { name: /start game/i }).first();
  await expect(startButton).toBeEnabled({ timeout: 30_000 });
  await startButton.click();

  await expect(hostPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });
  await expect(guestPage.getByRole('heading', { name: /topic selection/i })).toBeVisible({ timeout: 90_000 });
}

async function joinRoomAsGuest(page: Page, guestName: string, roomCode: string) {
  let joined = false;

  for (let attempt = 0; attempt < 5 && !joined; attempt += 1) {
    await openPlayScreen(page);
    const nameInput = await preferTestId(
      page.getByTestId('join-room-name-input'),
      () => {
        const nameInputs = page.getByPlaceholder('Enter your name');
        return nameInputs.nth(1);
      }
    );
    const roomCodeInput = await preferTestId(
      page.getByTestId('join-room-code-input'),
      () => page.getByPlaceholder(/e\.g\.,?\s*Success5Win3/i).first()
    );
    const joinButton = await preferTestId(
      page.getByTestId('join-room-submit'),
      () => page.getByRole('button', { name: /join game room|join game|join room/i }).first()
    );

    await fillInputReliably(nameInput, guestName);
    await fillInputReliably(roomCodeInput, roomCode);

    await roomCodeInput.press('Enter').catch(() => undefined);

    joined =
      (await page
        .waitForURL(new RegExp(`/game/${roomCode}$`, 'i'), { timeout: 20_000 })
        .then(() => true)
        .catch(() => false)) &&
      (await waitForJoinerLobbyState(page, 20_000).then(
        () => true,
        () => false
      ));

    if (joined) {
      break;
    }

    if (await isVisible(joinButton)) {
      await submitAction(page, joinButton, roomCodeInput);
    } else {
      await roomCodeInput.press('Enter').catch(() => undefined);
    }

    joined =
      (await page
        .waitForURL(new RegExp(`/game/${roomCode}$`, 'i'), { timeout: 15_000 })
        .then(() => true)
        .catch(() => false)) &&
      (await waitForJoinerLobbyState(page, 15_000).then(
        () => true,
        () => false
      ));

    if (joined) {
      break;
    }

    await page
      .goto(new URL(`game/${roomCode}`, APP_URL).toString(), {
        waitUntil: 'commit',
        timeout: 20_000,
      })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const directNameInput = page.getByPlaceholder('Enter your name').first();
    if (await isVisible(directNameInput)) {
      await fillInputReliably(directNameInput, guestName);

      const directJoinButton = page
        .getByRole('button', { name: /join game room|join room|continue|submit/i })
        .first();

      if (await isVisible(directJoinButton)) {
        await submitAction(page, directJoinButton, directNameInput);
      } else {
        await directNameInput.press('Enter').catch(() => undefined);
      }
    }

    joined =
      (await page
        .waitForURL(new RegExp(`/game/${roomCode}$`, 'i'), { timeout: 20_000 })
        .then(() => true)
        .catch(() => false)) &&
      (await waitForJoinerLobbyState(page, 20_000).then(
        () => true,
        () => false
      ));
  }

  if (!joined) {
    throw new Error(`Guest could not join room ${roomCode}.`);
  }
}

async function getAnonymousSessionState(page: Page) {
  return page.evaluate(() => {
    const authEntry = Object.entries(localStorage).find(([key]) => /supabase.*auth-token|sb-.*auth-token/i.test(key));
    if (!authEntry) {
      return {
        hasAuthEntry: false,
        isAnonymous: null,
        email: null,
      };
    }

    try {
      const parsed = JSON.parse(authEntry[1]) as {
        user?: { is_anonymous?: boolean; email?: string | null };
      };

      return {
        hasAuthEntry: true,
        isAnonymous: parsed.user?.is_anonymous ?? null,
        email: parsed.user?.email ?? null,
      };
    } catch {
      return {
        hasAuthEntry: true,
        isAnonymous: null,
        email: null,
      };
    }
  });
}

async function expectGuestRestored(
  page: Page,
  roomCode: string,
  playerName: string,
  expectedState: 'lobby' | 'game'
) {
  await expect(page).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'));
  await expect
    .poll(
      async () => ((await page.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
      { timeout: 90_000 }
    )
    .toMatch(
      expectedState === 'game'
        ? new RegExp(`${playerName}|Round\\s+\\d+|Topic Selection|Please select a topic from above`, 'i')
        : new RegExp(`${playerName}|Waiting for Players|Waiting for host|Players\\s*\\(\\d+/\\d+\\)`, 'i')
    );

  const persistedSessionValues = await page.evaluate(() => Object.values(sessionStorage).join(' '));
  expect(persistedSessionValues).toContain(playerName);

  const anonymousSession = await getAnonymousSessionState(page);
  if (anonymousSession.hasAuthEntry) {
    expect(anonymousSession.isAnonymous).toBe(true);
    expect(anonymousSession.email ?? '').toBe('');
  }
}

async function expectExpiredLinkMessage(page: Page) {
  await expect
    .poll(
      async () => ((await page.locator('body').innerText().catch(() => '')) ?? '').replace(/\s+/g, ' '),
      { timeout: 60_000 }
    )
    .toMatch(/room not found|doesn'?t exist|expired/i);
}

test.describe('anonymous player session restore', () => {
  test.describe.configure({ timeout: 360_000 });
  test.describe.configure({ mode: 'serial' });

  test('remembers guest display name across refresh and restores the player to the active lobby or game state', async ({
    browser,
  }) => {
    const releaseLock = await acquireLock(ANONYMOUS_LOCK_PATH);
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const hostName = `Host${runId}`;
    const guestName = `Guest${runId}`;

    try {
      const roomCode = await createRoom(hostPage, hostName);
      await joinRoomAsGuest(guestPage, guestName, roomCode);
      await releaseLock().catch(() => {});
      await expectGuestRestored(guestPage, roomCode, guestName, 'lobby');

      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.waitForLoadState('networkidle').catch(() => undefined);
      await expectGuestRestored(guestPage, roomCode, guestName, 'lobby');

      await startGameFromLobby(hostPage, guestPage);

      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.waitForLoadState('networkidle').catch(() => undefined);
      await expectGuestRestored(guestPage, roomCode, guestName, 'game');
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
      await releaseLock().catch(() => {});
    }
  });

  test('shows the expired-link message after refresh when the room is no longer active and does not create a signed-in account', async ({
    browser,
  }) => {
    const releaseLock = await acquireLock(ANONYMOUS_LOCK_PATH);
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const hostName = `Host${runId}`;
    const guestName = `Guest${runId}`;

    try {
      const roomCode = await createRoom(hostPage, hostName);
      await joinRoomAsGuest(guestPage, guestName, roomCode);
      await releaseLock().catch(() => {});
      await expectGuestRestored(guestPage, roomCode, guestName, 'lobby');

      await guestPage.evaluate((expiredCode) => {
        window.history.replaceState({}, '', `/game/${expiredCode}`);
      }, EXPIRED_ROOM_CODE);

      await guestPage.reload({ waitUntil: 'domcontentloaded' });
      await guestPage.waitForLoadState('networkidle').catch(() => undefined);

      await expectExpiredLinkMessage(guestPage);

      const anonymousSession = await getAnonymousSessionState(guestPage);
      if (anonymousSession.hasAuthEntry) {
        expect(anonymousSession.isAnonymous).toBe(true);
        expect(anonymousSession.email ?? '').toBe('');
      }
    } finally {
      await hostContext.close().catch(() => {});
      await guestContext.close().catch(() => {});
      await releaseLock().catch(() => {});
    }
  });
});
