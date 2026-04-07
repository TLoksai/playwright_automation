import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';

type Credentials = {
  email: string;
  password: string;
};

function readCredentials(role: 'HOST' | 'JOINER'): Credentials | null {
  const emailKey = `KNOWSY_${role}_EMAIL`;
  const passwordKey = `KNOWSY_${role}_PASSWORD`;
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

async function openMobileMenuIfPresent(page: Page) {
  const menuButton = page.getByRole('button', { name: /menu|toggle navigation/i }).first();
  if ((await menuButton.count()) > 0 && (await menuButton.isVisible())) {
    await menuButton.click();
  }
}

async function clickSignIn(page: Page) {
  const candidateLocators = [
    () => page.getByRole('link', { name: /sign in/i }).first(),
    () => page.getByRole('button', { name: /sign in/i }).first(),
    () => page.locator('text=/sign in/i').first(),
  ];

  for (const factory of candidateLocators) {
    const locator = factory();
    if ((await locator.count()) > 0) {
      if (!(await locator.isVisible())) {
        await openMobileMenuIfPresent(page);
      }
      await expect(locator).toBeVisible({ timeout: 10_000 });
      await locator.click();
      return;
    }
  }

  throw new Error('Could not locate a Sign In control on the landing page.');
}

async function signIn(page: Page, credentials: Credentials) {
  await page.goto(APP_URL);
  await openMobileMenuIfPresent(page);
  await clickSignIn(page);

  const emailInput = page.getByRole('textbox', { name: /email/i }).first();
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await emailInput.fill(credentials.email);

  const passwordInput = page.getByRole('textbox', { name: /password/i }).first();
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });
  await passwordInput.fill(credentials.password);

  const submitButton = page.getByRole('button', { name: /sign in/i }).first();
  await expect(submitButton).toBeEnabled({ timeout: 30_000 });
  await submitButton.click();
  await page.waitForLoadState('networkidle');
}

async function openPlaySurface(page: Page) {
  await page.goto(APP_URL);

  const playNowLink = page.getByRole('link', { name: /play now/i }).first();
  const startPlayingBtn = page.getByRole('button', { name: /start playing/i }).first();

  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else if (await startPlayingBtn.isVisible().catch(() => false)) {
    await startPlayingBtn.click();
  } else {
    const playNowButton = page.getByTestId('play-now-btn');
    if ((await playNowButton.count()) > 0 && (await playNowButton.isVisible())) {
      await playNowButton.click();
    } else {
      throw new Error('Could not find Play Now link or Start Playing button on /play.');
    }
  }
}

async function preferTestId(locator: Locator, fallback: () => Locator): Promise<Locator> {
  return (await locator.count()) > 0 ? locator.first() : fallback();
}

async function createRoomAndGetCode(page: Page, hostName: string) {
  await openPlaySurface(page);

  const createNameInput = await preferTestId(
    page.getByTestId('create-room-name-input'),
    () => page.getByPlaceholder('Enter your name').first()
  );
  await expect(createNameInput).toBeVisible({ timeout: 60_000 });
  await createNameInput.fill(hostName);

  const createRoomButton = await preferTestId(
    page.getByTestId('create-room-submit'),
    () => page.getByRole('button', { name: /create game room/i }).first()
  );
  await expect(createRoomButton).toBeEnabled({ timeout: 30_000 });
  await createRoomButton.click();

  const roomCodeLocator = await preferTestId(
    page.getByTestId('room-code'),
    () => page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first()
  );
  await expect(roomCodeLocator).toBeVisible({ timeout: 60_000 });
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code not found after creating the room.');
  }

  return roomCode;
}

async function fillJoinFormFields(page: Page, playerName: string, roomCode: string) {
  const joinNameInput = await preferTestId(
    page.getByTestId('join-room-name-input'),
    () => page.getByPlaceholder('Enter your name').nth(1)
  );
  await expect(joinNameInput).toBeVisible({ timeout: 60_000 });
  await joinNameInput.fill('');
  await joinNameInput.fill(playerName);

  const roomCodeInput = await preferTestId(
    page.getByTestId('join-room-code-input'),
    () => page.getByPlaceholder('e.g., Success5Win3')
  );
  await expect(roomCodeInput).toBeVisible({ timeout: 30_000 });
  await roomCodeInput.fill('');
  await roomCodeInput.fill(roomCode);

  return await preferTestId(
    page.getByTestId('join-room-submit'),
    () => page.getByRole('button', { name: /join game room/i }).first()
  );
}

async function prepareJoinForm(
  page: Page,
  playerName: string,
  roomCode: string,
  options: { skipNavigation?: boolean } = {}
) {
  if (!options.skipNavigation) {
    await openPlaySurface(page);
  }
  return fillJoinFormFields(page, playerName, roomCode);
}

async function closeContexts(contexts: BrowserContext[]) {
  await Promise.all(
    contexts.map(async (ctx) => {
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    })
  );
}

test('second browser using the same player name is blocked from joining', async ({ browser }) => {
  test.setTimeout(360_000);

  const hostCredentials = readCredentials('HOST');
  const joinerCredentials = readCredentials('JOINER');
  test.skip(!hostCredentials || !joinerCredentials, 'Set KNOWSY_* credentials in your .env before running this test.');

  const hostContext = await browser.newContext();
  const joinerContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const joinerPage = await joinerContext.newPage();
  const contexts = [hostContext, joinerContext];

  try {
    await signIn(hostPage, hostCredentials!);
    await signIn(joinerPage, joinerCredentials!);

    const duplicateName = 'SS';
    const alternateName = 'ww';

    const roomCode = await createRoomAndGetCode(hostPage, duplicateName);
    const playersHeading = hostPage.getByRole('heading', { name: /^Players/i }).first();
    await expect(playersHeading).toContainText('(1/6)', { timeout: 60_000 });

    const duplicateJoinButton = await prepareJoinForm(joinerPage, duplicateName, roomCode);
    await expect(duplicateJoinButton).toBeEnabled({ timeout: 30_000 });
    await duplicateJoinButton.click();

    await expect(joinerPage.getByText(/this name is already taken/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(playersHeading).toContainText('(1/6)', { timeout: 60_000 });

    const confirmedJoinButton = await prepareJoinForm(joinerPage, alternateName, roomCode, { skipNavigation: true });
    await expect(confirmedJoinButton).toBeEnabled({ timeout: 30_000 });
    await confirmedJoinButton.click();

    await expect(joinerPage.getByTestId('exit-game-btn')).toBeVisible({ timeout: 60_000 });
    await expect(playersHeading).toContainText('(2/6)', { timeout: 60_000 });

    await joinerPage.getByTestId('exit-game-btn').click();
    const confirmExitButton = joinerPage.getByRole('button', { name: /^exit game$/i }).first();
    if ((await confirmExitButton.count()) > 0) {
      await confirmExitButton.click();
    }

    await expect(playersHeading).toContainText('(1/6)', { timeout: 60_000 });
  } finally {
    await closeContexts(contexts);
  }
});
