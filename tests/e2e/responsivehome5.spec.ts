import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TABLET_LANDSCAPE = { width: 1024, height: 768 };
const PAGE_OVERFLOW_TOLERANCE_PX = 2;
const EDGE_SAFE_AREA_PX = 24;
const HERO_CENTER_TOLERANCE_PX = 56;
const HERO_MARGIN_BALANCE_TOLERANCE_PX = 96;
const HERO_VERTICAL_GAP_MIN_PX = 12;
const CTA_MIN_HEIGHT_PX = 44;
const CTA_MAX_WIDTH_RATIO = 0.52;
const CTA_MIN_WIDTH_RATIO = 0.18;
const HEADING_MIN_WIDTH_RATIO = 0.42;
const HEADING_MAX_WIDTH_RATIO = 0.74;

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
    page.locator('main').getByRole('heading', { level: 1 }).first(),
    page.locator('main h1').first(),
    page.locator('section h1').first(),
    page.getByRole('heading', { level: 1 }).first(),
  ];

  for (const heading of headings) {
    if (await isVisible(heading)) {
      return heading;
    }
  }

  throw new Error('Hero heading was not visible on the landing page.');
}

test.describe('Responsive landing page on tablet landscape', () => {
  test('content uses width properly and remains readable', async ({ page }) => {
    await page.setViewportSize(TABLET_LANDSCAPE);
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
        pageCenter: viewportWidth / 2,
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
        verticalGap: ctaRect.top - headingRect.bottom,
        overlaps,
      };
    });

    expect(metrics).not.toBeNull();
    if (!metrics) {
      throw new Error('Could not measure landing page tablet-landscape metrics.');
    }

    expect(
      metrics.scrollWidth,
      'Landing page should not overflow horizontally on tablet landscape.'
    ).toBeLessThanOrEqual(metrics.viewportWidth + PAGE_OVERFLOW_TOLERANCE_PX);

    expect(metrics.overlaps, 'Hero heading and CTA should not overlap on tablet landscape.').toBeFalsy();

    expect(
      metrics.heading.left,
      'Hero heading should remain inside the left edge on tablet landscape.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      metrics.viewportWidth - metrics.heading.right,
      'Hero heading should remain inside the right edge on tablet landscape.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      Math.abs(metrics.heading.center - metrics.pageCenter),
      'Hero heading should stay visually centered on tablet landscape.'
    ).toBeLessThanOrEqual(HERO_CENTER_TOLERANCE_PX);

    expect(
      Math.abs(metrics.heading.left - (metrics.viewportWidth - metrics.heading.right)),
      'Hero heading margins should remain balanced on tablet landscape.'
    ).toBeLessThanOrEqual(HERO_MARGIN_BALANCE_TOLERANCE_PX);

    expect(
      metrics.heading.width,
      'Hero heading should use the available tablet-landscape width.'
    ).toBeGreaterThanOrEqual(metrics.viewportWidth * HEADING_MIN_WIDTH_RATIO);

    expect(
      metrics.heading.width,
      'Hero heading should remain readable and not stretch awkwardly wide.'
    ).toBeLessThanOrEqual(metrics.viewportWidth * HEADING_MAX_WIDTH_RATIO);

    expect(
      metrics.cta.width,
      'Primary CTA should use enough width to remain readable on tablet landscape.'
    ).toBeGreaterThanOrEqual(metrics.viewportWidth * CTA_MIN_WIDTH_RATIO);

    expect(
      metrics.cta.width,
      'Primary CTA should not stretch awkwardly wide on tablet landscape.'
    ).toBeLessThanOrEqual(metrics.viewportWidth * CTA_MAX_WIDTH_RATIO);

    expect(
      metrics.cta.height,
      'Primary CTA should remain tap-friendly on tablet landscape.'
    ).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);

    expect(
      metrics.verticalGap,
      'Hero heading and CTA should preserve readable spacing on tablet landscape.'
    ).toBeGreaterThanOrEqual(HERO_VERTICAL_GAP_MIN_PX);
  });
});
