import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const TABLET_PORTRAIT = { width: 768, height: 1024 };
const EDGE_SAFE_AREA_PX = 16;
const CTA_MIN_HEIGHT_PX = 44;
const PAGE_OVERFLOW_TOLERANCE_PX = 2;
const HERO_ALIGNMENT_TOLERANCE_PX = 48;
const HERO_VERTICAL_GAP_MIN_PX = 12;

async function isVisible(locator: Locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function getPrimaryCta(page: Page) {
  const candidates = [
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

test.describe('Responsive landing page on tablet portrait', () => {
  test('layout adapts without overlap or clipped content', async ({ page }) => {
    await page.setViewportSize(TABLET_PORTRAIT);
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

      const ctaCandidates = Array.from(document.querySelectorAll('a, button')).filter((element) =>
        /play now|start playing/i.test((element.textContent ?? '').trim())
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
          center: headingRect.left + headingRect.width / 2,
          bottom: headingRect.bottom,
        },
        cta: {
          left: ctaRect.left,
          right: ctaRect.right,
          center: ctaRect.left + ctaRect.width / 2,
          top: ctaRect.top,
          height: ctaRect.height,
        },
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
      'Landing page should not overflow horizontally on tablet portrait.'
    ).toBeLessThanOrEqual(metrics.viewportWidth + PAGE_OVERFLOW_TOLERANCE_PX);

    expect(metrics.overlaps, 'Hero heading and CTA should not overlap on tablet portrait.').toBeFalsy();

    expect(
      metrics.heading.left,
      'Hero heading should remain fully inside the left edge.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      metrics.viewportWidth - metrics.heading.right,
      'Hero heading should remain fully inside the right edge.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      metrics.cta.left,
      'Primary CTA should remain fully inside the left edge.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      metrics.viewportWidth - metrics.cta.right,
      'Primary CTA should remain fully inside the right edge.'
    ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

    expect(
      metrics.cta.height,
      'Primary CTA should remain tap-friendly on tablet portrait.'
    ).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);

    expect(
      Math.abs(metrics.heading.center - metrics.cta.center),
      'Hero heading and CTA should stay visually aligned on tablet portrait.'
    ).toBeLessThanOrEqual(HERO_ALIGNMENT_TOLERANCE_PX);

    expect(
      metrics.verticalGap,
      'Hero content should preserve readable spacing between heading and CTA.'
    ).toBeGreaterThanOrEqual(HERO_VERTICAL_GAP_MIN_PX);
  });
});
