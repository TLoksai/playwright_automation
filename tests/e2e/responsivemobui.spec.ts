import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const PLAY_URL = new URL('play', APP_URL).toString();
const MIN_INPUT_HEIGHT_PX = 40;

const mobileTargets = [
  {
    projectName: 'Safari Mobile',
    label: 'iPhone 14 Safari',
    viewport: { width: 390, height: 844 },
  },
  {
    projectName: 'Chrome Mobile',
    label: 'Pixel 7 Chrome',
    viewport: { width: 412, height: 915 },
  },
];

async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count().catch(() => 0)) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function preferTestId(locator: Locator, fallback: () => Locator): Promise<Locator> {
  return (await locator.count()) > 0 ? locator.first() : fallback();
}

async function openPlayScreen(page: Page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const firstNameInput = await preferTestId(
      page.getByTestId('create-room-name-input'),
      () => page.getByPlaceholder('Enter your name').first()
    );

    const openedDirectly = await page
      .goto(PLAY_URL, { waitUntil: 'domcontentloaded', timeout: 25_000 })
      .then(() => true)
      .catch(() => false);

    if (openedDirectly) {
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

async function fillInputReliably(locator: Locator, value: string) {
  await locator.click();
  await locator.clear().catch(() => undefined);
  await locator.fill('');
  await locator.type(value, { delay: 30 }).catch(async () => {
    await locator.fill(value);
  });
}

async function getJoinForm(page: Page) {
  const nameInput = await preferTestId(
    page.getByTestId('join-room-name-input'),
    () => page.getByPlaceholder('Enter your name').nth(1)
  );
  const roomCodeInput = await preferTestId(
    page.getByTestId('join-room-code-input'),
    () => page.getByPlaceholder(/e\.g\.,?\s*Success5Win3/i).first()
  );
  const joinButton = await preferTestId(
    page.getByTestId('join-room-submit'),
    () => page.getByRole('button', { name: /join game room|join game|join room/i }).first()
  );

  return { nameInput, roomCodeInput, joinButton };
}

async function expectKeyboardSafe(locator: Locator, page: Page, label: string) {
  const readMetrics = () => locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
    };
  });

  await expect.poll(readMetrics, { timeout: 5_000 }).toMatchObject({
    top: expect.any(Number),
    bottom: expect.any(Number),
    height: expect.any(Number),
    viewportHeight: expect.any(Number),
  });

  let metrics = await readMetrics();
  if (metrics.bottom > metrics.viewportHeight || metrics.top < 0) {
    await locator.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(250);
    metrics = await readMetrics();
  }

  expect(metrics.top, `${label} should stay within the visible viewport.`).toBeGreaterThanOrEqual(0);
  expect(metrics.bottom, `${label} should stay above the keyboard/viewport bottom.`).toBeLessThanOrEqual(metrics.viewportHeight);
}

async function dismissKeyboard(page: Page) {
  await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    active?.blur();
  }).catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.locator('body').click({ position: { x: 10, y: 10 } }).catch(() => undefined);
}

test.describe('Mobile game entry keyboard usability', () => {
  for (const target of mobileTargets) {
    test(`join form remains usable with keyboard on ${target.label}`, async ({ page }) => {
      await page.setViewportSize(target.viewport);
      await openPlayScreen(page);

      const { nameInput, roomCodeInput, joinButton } = await getJoinForm(page);
      const displayName = `Guest ${Date.now()}`;
      const roomCode = 'Success5Win3';

      await expect(nameInput).toBeVisible({ timeout: 30_000 });
      await expect(roomCodeInput).toBeVisible({ timeout: 30_000 });
      await expect(joinButton).toBeVisible({ timeout: 30_000 });

      const nameHeight = await nameInput.evaluate((element) => element.getBoundingClientRect().height);
      expect(nameHeight).toBeGreaterThanOrEqual(MIN_INPUT_HEIGHT_PX);

      await fillInputReliably(nameInput, displayName);
      await expect(nameInput).toHaveValue(displayName);
      await expectKeyboardSafe(nameInput, page, 'Display name input');
      await expectKeyboardSafe(joinButton, page, 'Join Game button after name focus');

      await fillInputReliably(roomCodeInput, roomCode);
      await expect(roomCodeInput).toHaveValue(roomCode);
      await expect(joinButton).toBeEnabled({ timeout: 10_000 });
      await expectKeyboardSafe(roomCodeInput, page, 'Room code input');
      await expectKeyboardSafe(joinButton, page, 'Join Game button after room code focus');

      await dismissKeyboard(page);

      await expect(nameInput).toHaveValue(displayName);
      await expect(roomCodeInput).toHaveValue(roomCode);
      await expect(joinButton).toBeVisible();
      await expect(joinButton).toBeEnabled();
    });
  }
});
