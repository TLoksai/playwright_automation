import { expect, test, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const ORG_NAME = 'RICHELLE SALDANHA';
const ORG_SLUG = 'test.com';
const ORG_PLAY_URL = new URL(`/org/${ORG_SLUG}/play`, APP_URL).toString();

async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
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

async function expectOrgBranding(page: Page) {
  await expect(page.getByText(new RegExp(`Play\\s+${ORG_NAME}`, 'i')).first()).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole('link', { name: new RegExp(ORG_NAME, 'i') }).first()).toBeVisible({
    timeout: 30_000,
  });
}

async function openOrgPlayScreen(page: Page) {
  await page.goto(ORG_PLAY_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expectOrgBranding(page);
  await expect(page.getByPlaceholder('Enter your name').first()).toBeVisible({ timeout: 30_000 });
}

async function waitForLobby(page: Page, timeoutMs = 90_000) {
  await page.waitForFunction(
    () =>
      /Players\s*\(\d+\/\d+\)/i.test(document.body?.innerText ?? '') ||
      /Waiting for Players/i.test(document.body?.innerText ?? '') ||
      !!document.querySelector('[data-testid="start-game-btn"]') ||
      !!document.querySelector('[data-testid="add-ai-player-btn"]'),
    { timeout: timeoutMs }
  );
}

function extractRoomCode(url: string): string {
  const match = url.match(/\/game\/([^/?#]+)/i);
  if (!match) {
    throw new Error(`Room code not found in URL: ${url}`);
  }
  return decodeURIComponent(match[1]);
}

function roomCodeFromUrl(page: Page): string {
  return extractRoomCode(page.url());
}

async function createOrgRoom(page: Page, playerName: string) {
  let roomReady = false;
  for (let attempt = 0; attempt < 3 && !roomReady; attempt += 1) {
    await openOrgPlayScreen(page);

    const nameInput = page.getByPlaceholder('Enter your name').first();
    const createRoomButton = page.getByRole('button', { name: /create game room/i }).first();

    await fillInputReliably(nameInput, playerName);
    await expect(createRoomButton).toBeEnabled({ timeout: 15_000 });
    // await submitAction(page, createRoomButton, nameInput);
    // enter the name and press enter
    await nameInput.press('Enter').catch(() => undefined);


    roomReady = await page
      .waitForFunction(
        (slug) => window.location.pathname.includes(`/org/${slug}/game/`),
        ORG_SLUG,
        { timeout: 20_000 }
      )
      .then(() => true)
      .catch(() => false);
  }

  if (!roomReady) {
    throw new Error('Unable to create an organization-scoped room.');
  }

  await waitForLobby(page);

  const roomCode = roomCodeFromUrl(page);
  return {
    roomCode,
    orgGameUrl: new URL(`/org/${ORG_SLUG}/game/${roomCode}`, APP_URL).toString(),
    genericGameUrl: new URL(`/game/${roomCode}`, APP_URL).toString(),
  };
}

async function joinRoom(page: Page, gameUrl: string, playerName: string, options?: { expectBranding?: boolean }) {
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  if (options?.expectBranding) {
    await expectOrgBranding(page);
  } else {
    await expect(page.getByText(new RegExp(`Play\\s+${ORG_NAME}`, 'i')).first()).toHaveCount(0);
    await expect(page.getByRole('link', { name: new RegExp(ORG_NAME, 'i') }).first()).toHaveCount(0);
  }

  const roomCodeInput = page.getByPlaceholder(/e\.g\.,?\s*Success5Win3/i).first();
  const nameInputs = page.getByPlaceholder('Enter your name');
  const useJoinPanelInputs = (await roomCodeInput.count()) > 0 && (await nameInputs.count()) > 1;
  const nameInput = useJoinPanelInputs ? nameInputs.last() : nameInputs.first();

  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await fillInputReliably(nameInput, playerName);

  if (await isVisible(roomCodeInput) && !(await roomCodeInput.inputValue().catch(() => ''))) {
    await fillInputReliably(roomCodeInput, extractRoomCode(gameUrl));
  }

  const joinButton = page.getByRole('button', { name: /join game room|join room|continue|submit/i }).first();

  if (await isVisible(joinButton)) {
    // await submitAction(page, joinButton, nameInput);
    // press tab and enter to submit the form

        // await nameInput.press('Tab').catch(() => undefined);
        // await nameInput.press('Tab').catch(() => undefined);
        // press right arrow
        // await nameInput.press('ArrowRight').catch(() => undefined);

        // await nameInput.press('Enter').catch(() => undefined);
          await joinButton.click().catch(() => undefined);
  } else {
    await nameInput.press('Enter').catch(() => undefined);
  }

  await waitForLobby(page);
}

async function waitForPlayerCount(page: Page, expectedCount: number, timeoutMs = 30_000) {
  await expect
    .poll(
      async () => {
        const mainText = (await page.getByRole('main').innerText().catch(() => '')) ?? '';
        const match = mainText.match(/Players\s*\((\d+)\/6\)/i);
        return match ? Number(match[1]) : null;
      },
      { timeout: timeoutMs }
    )
    .toBe(expectedCount);
}

test.describe('organization game urls', () => {
  test.describe.configure({ timeout: 300_000 });

  test('shared org room links stay org-scoped, brand org joins, and generic links still work without org branding', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const orgJoinerContext = await browser.newContext();
    const orgJoinerPage = await orgJoinerContext.newPage();
    const genericJoinerContext = await browser.newContext();
    const genericJoinerPage = await genericJoinerContext.newPage();

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      const { roomCode, orgGameUrl, genericGameUrl } = await createOrgRoom(hostPage, `Host ${runId}`);

      expect(orgGameUrl).toContain(`/org/${ORG_SLUG}/game/${roomCode}`);
      expect(genericGameUrl).toContain(`/game/${roomCode}`);
      expect(orgGameUrl).not.toBe(genericGameUrl);
      await expect(hostPage).toHaveURL(new RegExp(`/org/${ORG_SLUG.replace('.', '\\.')}/game/${roomCode}$`, 'i'));

      await joinRoom(orgJoinerPage, orgGameUrl, `Org Joiner ${runId}`, { expectBranding: true });
      await expect(orgJoinerPage).toHaveURL(
        new RegExp(`/org/${ORG_SLUG.replace('.', '\\.')}/game/${roomCode}$`, 'i')
      );

      await joinRoom(genericJoinerPage, genericGameUrl, `Generic Joiner ${runId}`);
      await expect(genericJoinerPage).toHaveURL(new RegExp(`/game/${roomCode}$`, 'i'));

      await Promise.all([
        waitForPlayerCount(hostPage, 3),
        waitForPlayerCount(orgJoinerPage, 3),
        waitForPlayerCount(genericJoinerPage, 3),
      ]);
    } finally {
      await hostContext.close().catch(() => {});
      await orgJoinerContext.close().catch(() => {});
      await genericJoinerContext.close().catch(() => {});
    }
  });
});