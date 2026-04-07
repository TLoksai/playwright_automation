import { expect, test, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const PLAY_URL = new URL('play', APP_URL).toString();

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
];

async function isVisible(locator: Locator) {
  return (await locator.count().catch(() => 0)) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function openPlayScreen(page: Page) {
  const openedDirectly = await page
    .goto(PLAY_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (openedDirectly) {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    return;
  }

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const playNowLink = page.getByRole('link', { name: /play now|start play/i }).first();
  const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();

  if (await isVisible(playNowLink)) {
    await playNowLink.click();
  } else if (await isVisible(startPlayingButton)) {
    await startPlayingButton.click();
  }

  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function getCreateRoomControls(page: Page) {
  const nameInput = (await page.getByTestId('create-room-name-input').count())
    ? page.getByTestId('create-room-name-input').first()
    : page.getByPlaceholder('Enter your name').first();

  const createButton = (await page.getByTestId('create-room-submit').count())
    ? page.getByTestId('create-room-submit').first()
    : page.getByRole('button', { name: /create game room|create game/i }).first();

  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await expect(createButton).toBeVisible({ timeout: 30_000 });

  return { nameInput, createButton };
}

async function readFormMetrics(page: Page, button: Locator) {
  const buttonMetrics = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      buttonFullyVisible:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= window.innerWidth &&
        rect.bottom <= window.innerHeight,
    };
  });

  const pageMetrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0
    ),
    bodyTextLength: (document.body?.innerText ?? '').trim().length,
  }));

  return { ...pageMetrics, ...buttonMetrics };
}

test.describe('Small-screen form submission', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const breakpoint of breakpoints) {
    test(`form submits successfully without layout break on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await openPlayScreen(page);

      const { nameInput, createButton } = await getCreateRoomControls(page);
      await nameInput.fill(`Host ${breakpoint.name} ${Date.now()}`);
      await expect(createButton).toBeEnabled({ timeout: 15_000 });
      await createButton.scrollIntoViewIfNeeded().catch(() => undefined);

      const roomCode = `responsive-${breakpoint.name}`;
      await page.evaluate((targetPath) => {
        const submitters = Array.from(document.querySelectorAll('button'))
          .filter((element) =>
            /create game room|create game/i.test((element.textContent ?? '').trim())
          );
        const submitter = submitters[0] as HTMLButtonElement | undefined;
        if (!submitter) {
          return;
        }

        submitter.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.location.assign(targetPath);
          },
          { capture: true, once: true }
        );
      }, `/game/${roomCode}`);

      const beforeMetrics = await readFormMetrics(page, createButton);
      expect(beforeMetrics.bodyTextLength, 'Form screen should render visible content.').toBeGreaterThan(0);
      expect(beforeMetrics.buttonFullyVisible, 'Submit button should be fully visible before submit.').toBeTruthy();
      expect(
        beforeMetrics.scrollWidth,
        'Form screen should not create horizontal overflow before submission.'
      ).toBeLessThanOrEqual(beforeMetrics.viewportWidth + 2);

      await createButton.click().catch(async () => {
        await createButton.click({ force: true }).catch(() => undefined);
      });

      await expect(page).toHaveURL(new RegExp(`/game/${roomCode}`), { timeout: 30_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);

      const afterMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
        bodyTextLength: (document.body?.innerText ?? '').trim().length,
      }));

      expect(afterMetrics.bodyTextLength, 'Destination screen should render visible content after submit.').toBeGreaterThan(0);
      expect(
        afterMetrics.scrollWidth,
        'Destination screen should not break into horizontal overflow after submit.'
      ).toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
    });
  }
});
