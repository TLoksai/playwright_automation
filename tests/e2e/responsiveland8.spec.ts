import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const VIEWPORT = { width: 1280, height: 800 };
const EDGE_SAFE_AREA_PX = 12;

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function getPlayNowButton(page: Page) {
  const candidates = [
    page.locator('main').getByRole('link', { name: /play now/i }).first(),
    page.locator('main').getByRole('button', { name: /play now/i }).first(),
    page.getByRole('link', { name: /play now/i }).first(),
    page.getByRole('button', { name: /play now/i }).first(),
  ];

  for (const candidate of candidates) {
    if (await isVisible(candidate)) {
      return candidate;
    }
  }

  throw new Error('Play Now button was not visible.');
}

test.describe('Landing page Play Now visibility', () => {
  test('Play Now button is fully visible and not blocked', async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const playNowButton = await getPlayNowButton(page);
    await expect(playNowButton).toBeVisible();
    await playNowButton.scrollIntoViewIfNeeded();

    const metrics = await playNowButton.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        rightInset: window.innerWidth - rect.right,
        top: rect.top,
        bottomInset: window.innerHeight - rect.bottom,
        fullyInViewport:
          rect.left >= 0 &&
          rect.top >= 0 &&
          rect.right <= window.innerWidth &&
          rect.bottom <= window.innerHeight,
        clickableAtCenter: topElement === element || element.contains(topElement),
      };
    });

    expect(metrics.fullyInViewport, 'Play Now button should be fully visible in the viewport.').toBeTruthy();
    expect(metrics.clickableAtCenter, 'Play Now button should not be covered by another element.').toBeTruthy();
    expect(metrics.left, 'Play Now button should not be clipped on the left edge.').toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);
    expect(metrics.rightInset, 'Play Now button should not be clipped on the right edge.').toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);
    expect(metrics.top, 'Play Now button should not be clipped at the top.').toBeGreaterThanOrEqual(0);
    expect(metrics.bottomInset, 'Play Now button should not be clipped at the bottom.').toBeGreaterThanOrEqual(0);
  });
});
