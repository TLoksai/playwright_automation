import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const LAPTOP_VIEWPORT = { width: 1280, height: 800 };
const PAGE_OVERFLOW_TOLERANCE_PX = 2;
const HERO_CENTER_TOLERANCE_PX = 64;
const HERO_MARGIN_MIN_PX = 80;
const HERO_MARGIN_BALANCE_TOLERANCE_PX = 120;
const HERO_VERTICAL_GAP_MIN_PX = 16;
const CTA_MIN_HEIGHT_PX = 44;
const CTA_MAX_WIDTH_RATIO = 0.45;
const HEADING_MAX_WIDTH_RATIO = 0.72;

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function getPrimaryCta(page: Page) {
  const candidates = [
    page.locator('main').getByRole('link', { name: /play now/i }).first(),
    page.locator('main').getByRole('button', { name: /play now/i }).first(),
    page.locator('main').getByRole('button', { name: /start playing/i }).first(),
    page.locator('main').getByRole('link', { name: /start playing/i }).first(),
    page.getByRole('link', { name: /play now/i }).first(),
    page.getByRole('button', { name: /play now/i }).first(),
    page.getByRole('button', { name: /start playing/i }).first(),
    page.getByRole('link', { name: /start playing/i }).first(),
  ];

  for (const candidate of candidates) {
    if (await isVisible(candidate)) {
      return candidate;
    }
  }

  throw new Error('Primary landing-page CTA was not visible.');
}

async function getHeroHeading(page: Page) {
  const headings = [
    page.getByRole('heading', { level: 1 }).first(),
    page.locator('main h1').first(),
    page.locator('section h1').first(),
  ];

  for (const heading of headings) {
    if (await isVisible(heading)) {
      return heading;
    }
  }

  throw new Error('Hero heading was not visible on the landing page.');
}

test.describe('Responsive landing page on laptop', () => {
  test('hero UI stays centered and balanced without awkward stretching', async ({ page }) => {
    await page.setViewportSize(LAPTOP_VIEWPORT);
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const heroHeading = await getHeroHeading(page);
    const primaryCta = await getPrimaryCta(page);

    await expect(heroHeading).toBeVisible();
    await expect(primaryCta).toBeVisible();

    const metrics = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const scrollWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body?.scrollWidth ?? 0
      );

      const ctaCandidates = Array.from(document.querySelectorAll('main a, main button, section a, section button')).filter(
        (element) => /play now|start playing/i.test((element.textContent ?? '').trim())
      );
      const headingCandidates = Array.from(document.querySelectorAll('main h1, section h1, h1'));

      const visibleHeading = headingCandidates.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) as HTMLElement | undefined;

      const visibleCta = ctaCandidates.find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) as HTMLElement | undefined;

      if (!visibleHeading || !visibleCta) {
        return null;
      }

      const headingRect = visibleHeading.getBoundingClientRect();
      const ctaRect = visibleCta.getBoundingClientRect();
      const overlaps =
        headingRect.left < ctaRect.right &&
        headingRect.right > ctaRect.left &&
        headingRect.top < ctaRect.bottom &&
        headingRect.bottom > ctaRect.top;

      return {
        viewportWidth,
        scrollWidth,
        heading: {
          left: headingRect.left,
          right: headingRect.right,
          width: headingRect.width,
          center: headingRect.left + headingRect.width / 2,
          bottom: headingRect.bottom,
        },
        cta: {
          left: ctaRect.left,
          right: ctaRect.right,
          width: ctaRect.width,
          height: ctaRect.height,
          center: ctaRect.left + ctaRect.width / 2,
          top: ctaRect.top,
        },
        pageCenter: viewportWidth / 2,
        verticalGap: ctaRect.top - headingRect.bottom,
        overlaps,
      };
    });

    expect(metrics).not.toBeNull();
    if (!metrics) {
      throw new Error('Could not measure landing page hero metrics.');
    }

    expect(
      metrics.scrollWidth,
      'Landing page should not overflow horizontally on laptop.'
    ).toBeLessThanOrEqual(metrics.viewportWidth + PAGE_OVERFLOW_TOLERANCE_PX);

    expect(metrics.overlaps, 'Hero heading and CTA should not overlap on laptop.').toBeFalsy();

    expect(
      Math.abs(metrics.heading.center - metrics.pageCenter),
      'Hero heading should stay centered on laptop.'
    ).toBeLessThanOrEqual(HERO_CENTER_TOLERANCE_PX);

    expect(
      metrics.heading.left,
      'Hero heading should keep a healthy left margin on laptop.'
    ).toBeGreaterThanOrEqual(HERO_MARGIN_MIN_PX);

    expect(
      metrics.viewportWidth - metrics.heading.right,
      'Hero heading should keep a healthy right margin on laptop.'
    ).toBeGreaterThanOrEqual(HERO_MARGIN_MIN_PX);

    expect(
      Math.abs(metrics.heading.left - (metrics.viewportWidth - metrics.heading.right)),
      'Hero heading margins should remain visually balanced on laptop.'
    ).toBeLessThanOrEqual(HERO_MARGIN_BALANCE_TOLERANCE_PX);

    expect(
      metrics.heading.width,
      'Hero heading should not stretch awkwardly wide on laptop.'
    ).toBeLessThanOrEqual(metrics.viewportWidth * HEADING_MAX_WIDTH_RATIO);

    expect(
      metrics.cta.width,
      'Primary CTA should not stretch awkwardly wide on laptop.'
    ).toBeLessThanOrEqual(metrics.viewportWidth * CTA_MAX_WIDTH_RATIO);

    expect(
      metrics.cta.height,
      'Primary CTA should remain comfortably clickable on laptop.'
    ).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);

    expect(
      metrics.verticalGap,
      'Hero content should preserve readable spacing between heading and CTA on laptop.'
    ).toBeGreaterThanOrEqual(HERO_VERTICAL_GAP_MIN_PX);
  });
});
