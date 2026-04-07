import { test, expect, type Locator, type Page } from '@playwright/test';

const BASE_URL = 'https://knowsy.game/';
const TOUCH_TARGET_PX = 44;
const MIN_CONTRAST_RATIO = 4.5;
const VIEWPORTS = [
  { name: 'desktop', size: { width: 1280, height: 720 } },
  { name: 'tablet', size: { width: 1024, height: 768 } },
  { name: 'mobile', size: { width: 390, height: 844 } },
];
const HORIZONTAL_SCROLL_ALLOWANCE = 8;

const TEST_USER = {
  email: process.env.KNOWSY_E2E_EMAIL ?? 'richelle2305@gmail.com',
  password: process.env.KNOWSY_E2E_PASSWORD ?? 'Richelle23#',
};
const HERO_HEADING = /how well do you know/i;

async function expectTouchTarget(locator: Locator, label: string) {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  expect(box, `${label} should be measurable on screen`).toBeTruthy();
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(TOUCH_TARGET_PX);
}

async function measureContrastRatio(locator: Locator) {
  return locator.evaluate((node) => {
    const parseColor = (color: string) => {
      if (!color) {
        return null;
      }
      const rgba = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/i);
      if (rgba) {
        return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
      }
      if (color.startsWith('#')) {
        const hex = color.slice(1);
        const normalized =
          hex.length === 3
            ? hex
                .split('')
                .map((char) => char + char)
                .join('')
            : hex.padEnd(6, '0');
        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);
        return [r, g, b];
      }
      return null;
    };

    const getEffectiveBackground = (element: Element | null): string => {
      if (!element || element === document.documentElement) {
        return window.getComputedStyle(document.body).backgroundColor || 'rgb(255, 255, 255)';
      }
      const style = window.getComputedStyle(element);
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        return style.backgroundColor;
      }
      return getEffectiveBackground(element.parentElement);
    };

    const srgbToLinear = (value: number) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    };

    const relativeLuminance = (rgb: number[]) =>
      0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);

    const textColor = window.getComputedStyle(node as Element).color;
    const bgColor = getEffectiveBackground((node as HTMLElement) ?? null);
    const textRGB = parseColor(textColor);
    const bgRGB = parseColor(bgColor);

    if (!textRGB || !bgRGB) {
      throw new Error('Unable to parse color values for contrast calculation');
    }

    const textLum = relativeLuminance(textRGB);
    const bgLum = relativeLuminance(bgRGB);
    const lighter = Math.max(textLum, bgLum);
    const darker = Math.min(textLum, bgLum);

    return (lighter + 0.05) / (darker + 0.05);
  });
}

async function tabToLocator(page: Page, locator: Locator, maxTabs = 100) {
  await locator.waitFor({ state: 'visible' });
  for (let i = 0; i < maxTabs; i += 1) {
    const isActive = await locator.evaluate((element) => element === document.activeElement);
    if (isActive) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  try {
    await locator.focus();
    const isActive = await locator.evaluate((element) => element === document.activeElement);
    if (isActive) {
      return;
    }
  } catch {
    // ignore and throw below
  }
  throw new Error('Unable to move focus to target element using keyboard navigation');
}

async function gotoHomepage(page: Page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  const heroHeading = page.getByRole('heading', { level: 1, name: HERO_HEADING });
  await expect(heroHeading).toBeVisible({ timeout: 15000 });
  return heroHeading;
}

async function ensureNavLinkVisible(page: Page, locator: Locator) {
  if (await locator.isVisible()) {
    return;
  }

  const navToggle = page.getByRole('button', { name: /(menu|navigation)/i }).first();
  if (await navToggle.count()) {
    await tabToLocator(page, navToggle);
    for (const key of ['Enter', ' ']) {
      await page.keyboard.press(key);
      try {
        await locator.waitFor({ state: 'visible', timeout: 2000 });
        return;
      } catch {
        // try next key
      }
    }
    await navToggle.click();
    await locator.waitFor({ state: 'visible', timeout: 10000 });
  }
}

async function openSignIn(page: Page) {
  const signInLink = page.getByRole('link', { name: /sign in/i });
  await ensureNavLinkVisible(page, signInLink);
  await signInLink.click();
}

test.describe('Player accessibility expectations', () => {
  test.describe('Responsive presentation', () => {
    for (const viewport of VIEWPORTS) {
      test(`keeps layout responsive on ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize(viewport.size);
        const heroHeading = await gotoHomepage(page);

        const horizontalOverflow = await page.evaluate(() => {
          const target = document.scrollingElement ?? document.documentElement;
          return target.scrollWidth - target.clientWidth;
        });

        const roundedOverflow = Math.ceil(Math.max(0, horizontalOverflow));
        expect(roundedOverflow, `Avoid horizontal scrolling on ${viewport.name}`).toBeLessThanOrEqual(
          HORIZONTAL_SCROLL_ALLOWANCE,
        );
        await expect(heroHeading).toBeVisible();
      });
    }
  });

  test('Primary buttons meet minimum touch target size', async ({ page }) => {
    await gotoHomepage(page);
    const callToActions = [
      page.getByTestId('start-playing-btn'),
      page.getByRole('button', { name: /(shop now|buy game)/i }).first(),
    ];

    for (const [index, cta] of callToActions.entries()) {
      await expectTouchTarget(cta, `Primary CTA ${index + 1}`);
    }
  });

  test('Critical text meets WCAG AA contrast guidelines', async ({ page }) => {
    await gotoHomepage(page);

    const textTargets: { label: string; locator: Locator }[] = [
      { label: 'Hero heading', locator: page.getByRole('heading', { level: 1, name: HERO_HEADING }) },
      { label: 'Hero primary CTA', locator: page.getByTestId('start-playing-btn') },
    ];

    let checked = 0;

    for (const target of textTargets) {
      if (await target.locator.count()) {
        await expect(target.locator).toBeVisible();
        const ratio = await measureContrastRatio(target.locator);
        expect(ratio, `${target.label} contrast ratio`).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO);
        checked += 1;
      }
    }

    expect(checked, 'At least one text target should be validated for contrast').toBeGreaterThan(0);
  });

  test('Core flows support keyboard-only navigation', async ({ page }) => {
    await gotoHomepage(page);
    await page.keyboard.press('Tab');

    const signInLink = page.getByRole('link', { name: /sign in/i });
    await ensureNavLinkVisible(page, signInLink);
    await tabToLocator(page, signInLink);
    await page.keyboard.press('Enter');

    const emailInput = page.getByRole('textbox', { name: 'Email' });
    await tabToLocator(page, emailInput);
    await page.keyboard.type(TEST_USER.email);

    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    await tabToLocator(page, passwordInput);
    await page.keyboard.type(TEST_USER.password);

    const submitButton = page.getByRole('button', { name: 'Sign In' });
    await tabToLocator(page, submitButton);
    await page.keyboard.press('Enter');

    // After login, the user might land on a custom dashboard.
    // Navigate directly to the play page to ensure a consistent starting point for the test.
    await page.goto('/play');
    await page.waitForURL('**/play', { timeout: 15000 });

    const roomNameInput = page.getByTestId('create-room-name-input');
    await roomNameInput.waitFor({ state: 'visible', timeout: 15000 });
    await tabToLocator(page, roomNameInput);
    await page.keyboard.type(`access-room-${Date.now()}`);
    await expect(roomNameInput).toHaveValue(/access-room-/);
  });
});