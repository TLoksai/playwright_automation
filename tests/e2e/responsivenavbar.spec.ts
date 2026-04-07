import { test, expect, devices, type Locator, type Page } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 640 } },
  { name: 'mobile', viewport: devices['Pixel 5'].viewport },
  { name: 'mobile-large', viewport: { width: 430, height: 932 } },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 } },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'desktop-wide', viewport: { width: 1440, height: 900 } },
];

const mobileBreakpoints = breakpoints.filter((breakpoint) => breakpoint.name.startsWith('mobile'));
const MAX_DRAWER_WIDTH_RATIO = 0.9;
const HORIZONTAL_OVERFLOW_TOLERANCE_PX = 20;

function getMenuTrigger(page: Page) {
  return page.getByTestId('mobile-menu-trigger');
}

function getDialog(page: Page) {
  return page.getByRole('dialog').first();
}

function getMenuNav(page: Page) {
  return getDialog(page).locator('nav, [role="navigation"]').first();
}

async function isCollapsedNav(page: Page) {
  return getMenuTrigger(page).isVisible().catch(() => false);
}

async function openMenu(page: Page) {
  const trigger = getMenuTrigger(page);
  await expect(trigger).toBeVisible();

  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await trigger.click();
  }

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(getDialog(page)).toBeVisible();
  await expect(getMenuNav(page)).toBeVisible();
}

async function closeMenuWithTrigger(page: Page) {
  const trigger = getMenuTrigger(page);
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    return;
  }

  const closeButton = getDialog(page).getByRole('button', { name: /close/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await trigger.click();
  }

  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function getHorizontalMetrics(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      clientWidth: doc.clientWidth,
      scrollX: window.scrollX,
    };
  });
}

async function clickOutsideDrawer(page: Page, nav: Locator) {
  const box = await nav.boundingBox();
  if (!box) {
    throw new Error('Could not measure mobile navigation drawer.');
  }

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('Viewport size is unavailable.');
  }

  const leftGap = box.x;
  const rightGap = viewport.width - (box.x + box.width);
  const targetX = leftGap >= rightGap
    ? Math.max(4, Math.floor(box.x / 2))
    : Math.min(viewport.width - 4, Math.floor(box.x + box.width + rightGap / 2));
  const targetY = Math.min(viewport.height - 4, Math.max(4, Math.floor(box.y + 24)));

  await page.mouse.click(targetX, targetY);
}

async function clickMenuItemAndWaitForClose(page: Page) {
  const dialog = getDialog(page);
  const link = dialog.getByRole('link', { name: /start playing/i }).first();
  await expect(link).toBeVisible();

  const href = await link.getAttribute('href');
  const startUrl = page.url();
  await link.click();

  await expect
    .poll(async () => {
      const triggerExpanded = await getMenuTrigger(page).getAttribute('aria-expanded').catch(() => null);
      const dialogVisible = await dialog.isVisible().catch(() => false);
      const urlChanged = href
        ? page.url() === new URL(href, startUrl).toString()
        : false;
      return triggerExpanded !== 'true' || !dialogVisible || urlChanged;
    })
    .toBeTruthy();
}

test.describe('Responsive mobile navbar overlay behavior', () => {
  for (const breakpoint of mobileBreakpoints) {
    test(`hamburger menu opens as stable overlay without horizontal overflow on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.goto('/');

      const trigger = getMenuTrigger(page);
      const triggerBefore = await trigger.boundingBox();
      const metricsBefore = await getHorizontalMetrics(page);

      await openMenu(page);

      const nav = getMenuNav(page);
      const dialog = getDialog(page);
      const navBox = await nav.boundingBox();
      const triggerAfter = await trigger.boundingBox();
      const metricsAfter = await getHorizontalMetrics(page);

      expect(navBox).not.toBeNull();
      expect(triggerBefore).not.toBeNull();
      expect(triggerAfter).not.toBeNull();
      if (!navBox || !triggerBefore || !triggerAfter) {
        throw new Error('Could not measure menu drawer or trigger positions.');
      }

      const overlayStyles = await dialog.evaluate((element) => {
        const dialogStyle = window.getComputedStyle(element);
        const nav = element.querySelector('nav, [role="navigation"]');
        const navStyle = nav ? window.getComputedStyle(nav) : null;
        return {
          dialogPosition: dialogStyle.position,
          navPosition: navStyle?.position ?? null,
        };
      });

      expect(['fixed', 'absolute']).toContain(overlayStyles.dialogPosition);
      expect(Math.round(triggerAfter.x)).toBe(Math.round(triggerBefore.x));
      expect(Math.round(metricsAfter.scrollX)).toBe(Math.round(metricsBefore.scrollX));
      expect(metricsAfter.scrollWidth - metricsAfter.viewportWidth).toBeLessThanOrEqual(HORIZONTAL_OVERFLOW_TOLERANCE_PX);
      expect(navBox.width).toBeLessThanOrEqual(Math.ceil(metricsAfter.viewportWidth * MAX_DRAWER_WIDTH_RATIO) + 1);

      await closeMenuWithTrigger(page);
    });
  }

  test('hamburger menu closes when tapping outside the drawer', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);
    await page.goto('/');

    await openMenu(page);
    const nav = getMenuNav(page);

    await clickOutsideDrawer(page, nav);

    await expect(getMenuTrigger(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(getDialog(page)).toBeHidden();
  });

  test('hamburger menu closes after selecting a navigation item', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);
    await page.goto('/');

    await openMenu(page);
    await clickMenuItemAndWaitForClose(page);

    await expect.poll(async () => (await getMenuTrigger(page).getAttribute('aria-expanded').catch(() => 'false')) !== 'true').toBeTruthy();
  });
});
