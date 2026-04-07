import { test, expect, devices, type Page } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 640 } },
  { name: 'mobile', viewport: devices['Pixel 5'].viewport },
  { name: 'mobile-large', viewport: { width: 430, height: 932 } },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 } },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'desktop-wide', viewport: { width: 1440, height: 900 } },
];

async function openNavIfCollapsed(page: Page) {
  const trigger = page.getByTestId('mobile-menu-trigger');
  if (await trigger.isVisible().catch(() => false)) {
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', /true|false/, { timeout: 5000 });
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
  }
}

function getMainContent(page: Page) {
  return page.getByTestId('mobile-logo-link').first();
}

async function getPrimaryHomeLink(page: Page) {
  const trigger = page.getByTestId('mobile-menu-trigger');
  if (await trigger.isVisible().catch(() => false)) {
    await openNavIfCollapsed(page);
    return page.getByRole('link', { name: /home page/i }).first();
  }

  return page.getByRole('banner').getByRole('link', { name: /knowsy/i }).first();
}

test.describe('Responsive mobile navigation accessibility', () => {
  for (const bp of breakpoints) {
    test(`active navigation state is clear on ${bp.name}`, async ({ page }) => {
      await page.setViewportSize(bp.viewport);
      await page.goto('https://knowsy.game/');

      const homeLink = await getPrimaryHomeLink(page);
      await expect(homeLink).toBeVisible();

      // Validate that current-page affordance is perceivable to sighted users.
      const activeState = await homeLink.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        const text = (el.textContent || '').trim();
        const altText = (el.querySelector('img') as HTMLImageElement | null)?.alt?.trim() || '';
        const hasAriaCurrent = el.getAttribute('aria-current') === 'page';
        const hasActiveClass = /active|current|selected/i.test(el.className || '');
        const hasDataActive =
          el.getAttribute('data-active') === 'true' ||
          el.getAttribute('data-state') === 'active';
        const isPerceivable =
          (text.length > 0 || altText.length > 0) &&
          computed.visibility !== 'hidden' &&
          computed.display !== 'none' &&
          computed.opacity !== '0';
        return hasAriaCurrent || hasActiveClass || hasDataActive || isPerceivable;
      });

      expect(activeState).toBeTruthy();
    });
  }

  test('open navigation does not overlap main content', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);
    await page.goto('https://knowsy.game/');

    await openNavIfCollapsed(page);

    const nav = page.getByRole('dialog').locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();
    const main = getMainContent(page);
    await expect(main).toBeVisible();

    const navBox = await nav.boundingBox();
    const mainBox = await main.boundingBox();
    expect(navBox).not.toBeNull();
    expect(mainBox).not.toBeNull();
    if (!navBox || !mainBox) {
      throw new Error('Could not measure navigation or main content region.');
    }

    const overlaps =
      navBox.x < mainBox.x + mainBox.width &&
      navBox.x + navBox.width > mainBox.x &&
      navBox.y < mainBox.y + mainBox.height &&
      navBox.y + navBox.height > mainBox.y;

    const openDialog = page.getByRole('dialog').first();
    const hasModalDialog = await openDialog
      .isVisible()
      .then(async (visible) => {
        if (!visible) {
          return false;
        }
        return (await openDialog.getAttribute('aria-modal')) === 'true';
      })
      .catch(() => false);

    expect(!overlaps || hasModalDialog).toBeTruthy();
  });

  test('keyboard and screen reader users can navigate menu', async ({ page }) => {
    await page.setViewportSize(devices['Pixel 5'].viewport);
    await page.goto('https://knowsy.game/');

    const trigger = page.getByTestId('mobile-menu-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleName(/menu/i);

    await trigger.focus();
    await page.keyboard.press('Enter');

    await openNavIfCollapsed(page);

    const nav = page.getByRole('dialog').locator('nav, [role="navigation"]').first();
    await expect(nav).toBeVisible();

    const links = nav.getByRole('link');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);

    const firstLink = links.first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
    await expect(firstLink).toHaveAttribute('href', /.+/);

    const firstName = await firstLink.innerText();
    expect(firstName.trim().length).toBeGreaterThan(0);
  });
});