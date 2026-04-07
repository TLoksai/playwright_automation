import { test, expect, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const HORIZONTAL_SCROLL_TOLERANCE_PX = 1;
const EDGE_SAFE_AREA_PX = 8;

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
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

test.describe('Responsive landing page load on small mobile', () => {
  for (const breakpoint of breakpoints) {
    test(`page loads cleanly on ${breakpoint.name}`, async ({ page }) => {
      test.skip(
        !/chrome mobile|chrome tab/i.test(test.info().project.name),
        'This landing-page smoke check targets the Chromium mobile-class projects only.'
      );

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
        const scrollStartX = window.scrollX;
        window.scrollTo(48, window.scrollY);
        const scrollAfterProbeX = window.scrollX;
        window.scrollTo(scrollStartX, window.scrollY);

        const ctaCandidates = Array.from(document.querySelectorAll('main a, main button, section a, section button, a, button')).filter(
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
        const headingTextOverflow = visibleHeading.scrollWidth - visibleHeading.clientWidth;
        const ctaTextOverflow = visibleCta.scrollWidth - visibleCta.clientWidth;

        return {
          viewportWidth,
          scrollWidth,
          horizontalScrollDelta: Math.abs(scrollAfterProbeX - scrollStartX),
          heading: {
            left: headingRect.left,
            right: headingRect.right,
            top: headingRect.top,
            bottom: headingRect.bottom,
            textOverflow: headingTextOverflow,
          },
          cta: {
            left: ctaRect.left,
            right: ctaRect.right,
            top: ctaRect.top,
            bottom: ctaRect.bottom,
            textOverflow: ctaTextOverflow,
          },
          bodyTextLength: (document.body?.innerText ?? '').trim().length,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        throw new Error('Could not measure landing page layout metrics.');
      }

      expect(metrics.bodyTextLength, 'Landing page should load with visible content.').toBeGreaterThan(0);

      expect(
        metrics.horizontalScrollDelta,
        'Landing page should not create horizontal scroll on small mobile.'
      ).toBeLessThanOrEqual(HORIZONTAL_SCROLL_TOLERANCE_PX);

      expect(
        metrics.heading.left,
        'Hero heading should not be clipped on the left edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.viewportWidth - metrics.heading.right,
        'Hero heading should not be clipped on the right edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.cta.left,
        'Primary CTA should not be clipped on the left edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.viewportWidth - metrics.cta.right,
        'Primary CTA should not be clipped on the right edge.'
      ).toBeGreaterThanOrEqual(EDGE_SAFE_AREA_PX);

      expect(
        metrics.heading.textOverflow,
        'Hero heading text should not be cut off horizontally.'
      ).toBeLessThanOrEqual(1);

      expect(
        metrics.cta.textOverflow,
        'Primary CTA text should not be cut off horizontally.'
      ).toBeLessThanOrEqual(1);

      expect(
        metrics.heading.bottom,
        'Hero heading should render within the visible page area.'
      ).toBeGreaterThan(metrics.heading.top);

      expect(
        metrics.cta.bottom,
        'Primary CTA should render within the visible page area.'
      ).toBeGreaterThan(metrics.cta.top);
    });
  }
});
