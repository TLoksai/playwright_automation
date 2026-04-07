import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const CTA_MIN_HEIGHT_PX = 44;
const CTA_EDGE_SAFE_AREA_PX = 8;
const HERO_WIDTH_FILL_RATIO = 0.7;
const HERO_WIDTH_TOLERANCE_PX = 4;
const HERO_VERTICAL_GAP_MIN_PX = 8;

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
];

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

test.describe('Responsive landing page on small mobile', () => {
  for (const breakpoint of breakpoints) {
    test(`hero layout remains aligned on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
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

        const ctaCandidates = Array.from(document.querySelectorAll('a,button')).filter((element) =>
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
        const ctaParentRect = visibleCta.parentElement?.getBoundingClientRect() ?? ctaRect;

        return {
          viewportWidth,
          heading: {
            width: headingRect.width,
            left: headingRect.left,
            right: headingRect.right,
            center: headingRect.left + headingRect.width / 2,
          },
          cta: {
            height: ctaRect.height,
            width: ctaRect.width,
            left: ctaRect.left,
            rightInset: viewportWidth - ctaRect.right,
            center: ctaRect.left + ctaRect.width / 2,
            top: ctaRect.top,
            parentWidth: ctaParentRect.width,
          },
          verticalGap: ctaRect.top - headingRect.bottom,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        throw new Error('Could not measure landing page hero metrics.');
      }

      expect(
        metrics.heading.width,
        'Hero heading should fill most of the mobile content column.'
      ).toBeGreaterThanOrEqual(metrics.viewportWidth * HERO_WIDTH_FILL_RATIO - HERO_WIDTH_TOLERANCE_PX);

      expect(
        metrics.heading.left,
        'Hero heading should respect the left safe area.'
      ).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);

      expect(
        metrics.viewportWidth - metrics.heading.right,
        'Hero heading should respect the right safe area.'
      ).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.height,
        'Primary CTA should be tall enough for mobile tapping.'
      ).toBeGreaterThanOrEqual(CTA_MIN_HEIGHT_PX);

      expect(
        metrics.cta.left,
        'Primary CTA should not sit against the left screen edge.'
      ).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.rightInset,
        'Primary CTA should not sit against the right screen edge.'
      ).toBeGreaterThanOrEqual(CTA_EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.width / metrics.cta.parentWidth,
        'Primary CTA should fill its mobile container.'
      ).toBeGreaterThanOrEqual(0.9);

      expect(
        Math.abs(metrics.heading.center - metrics.cta.center),
        'Hero CTA should remain horizontally aligned with the hero heading.'
      ).toBeLessThanOrEqual(24);

      expect(
        metrics.verticalGap,
        'Hero CTA should preserve readable spacing below the heading.'
      ).toBeGreaterThanOrEqual(HERO_VERTICAL_GAP_MIN_PX);
    });
  }
});
