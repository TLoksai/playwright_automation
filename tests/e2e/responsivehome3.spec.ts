import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const EDGE_SAFE_AREA_PX = 12;
const HERO_ALIGNMENT_TOLERANCE_PX = 40;
const HERO_VERTICAL_GAP_MIN_PX = 10;
const CTA_MIN_HEIGHT_PX = 44;
const HERO_WIDTH_FILL_RATIO = 0.62;
const HERO_WIDTH_TOLERANCE_PX = 4;

const breakpoints = [
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
  { name: 'mobile-xl', viewport: { width: 430, height: 932 } },
];

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

test.describe('Responsive landing page on large mobile', () => {
  for (const breakpoint of breakpoints) {
    test(`all content is visible and aligned on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle').catch(() => undefined);

      const heroHeading = await getHeroHeading(page);
      const primaryCta = await getPrimaryCta(page);

      await expect(heroHeading).toBeVisible();
      await expect(primaryCta).toBeVisible();

      const metrics = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const headingCandidates = Array.from(document.querySelectorAll('main h1, section h1, h1'));
        const ctaCandidates = Array.from(document.querySelectorAll('main a, main button, section a, section button, a, button')).filter(
          (element) => /play now|start playing/i.test((element.textContent ?? '').trim())
        );

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
        const ctaParentRect = visibleCta.parentElement?.getBoundingClientRect() ?? ctaRect;

        return {
          viewportWidth,
          heading: {
            width: headingRect.width,
            left: headingRect.left,
            right: headingRect.right,
            center: headingRect.left + headingRect.width / 2,
            bottom: headingRect.bottom,
          },
          cta: {
            width: ctaRect.width,
            height: ctaRect.height,
            left: ctaRect.left,
            right: ctaRect.right,
            center: ctaRect.left + ctaRect.width / 2,
            top: ctaRect.top,
            parentWidth: ctaParentRect.width,
          },
          verticalGap: ctaRect.top - headingRect.bottom,
          bodyTextLength: (document.body?.innerText ?? '').trim().length,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        throw new Error('Could not measure landing page large-mobile metrics.');
      }

      expect(metrics.bodyTextLength, 'Landing page should load with visible content.').toBeGreaterThan(0);

      expect(
        metrics.heading.width,
        'Hero heading should still fill the large-mobile content column.'
      ).toBeGreaterThanOrEqual(metrics.viewportWidth * HERO_WIDTH_FILL_RATIO - HERO_WIDTH_TOLERANCE_PX);

      expect(
        metrics.heading.left,
        'Hero heading should remain inside the left viewport edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.viewportWidth - metrics.heading.right,
        'Hero heading should remain inside the right viewport edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.left,
        'Primary CTA should remain inside the left viewport edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.viewportWidth - metrics.cta.right,
        'Primary CTA should remain inside the right viewport edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.height,
        'Primary CTA should remain tap-friendly on large mobile.'
      ).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);

      expect(
        metrics.cta.width / metrics.cta.parentWidth,
        'Primary CTA should stay aligned with its large-mobile content column.'
      ).toBeGreaterThanOrEqual(0.88);

      expect(
        Math.abs(metrics.heading.center - metrics.cta.center),
        'Hero heading and CTA should remain horizontally aligned on large mobile.'
      ).toBeLessThanOrEqual(HERO_ALIGNMENT_TOLERANCE_PX);

      expect(
        metrics.verticalGap,
        'Hero heading and CTA should keep readable vertical spacing on large mobile.'
      ).toBeGreaterThanOrEqual(HERO_VERTICAL_GAP_MIN_PX);
    });
  }
});
