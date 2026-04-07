import { test, expect, type Locator, type Page } from '@playwright/test';

const AUTH_URL = 'https://knowsy.game/auth';
const DASHBOARD_URL = 'https://knowsy.game/dashboard';
const ORG_NAME = 'RICHELLE SALDANHA';
const ORG_SLUG = 'test.com';

const credentials = {
  email: 'richelle2305@gmail.com',
  password: 'Richelle23#',
};

const mobileAnalyticsBreakpoints = [
  { name: 'mobile-360', viewport: { width: 360, height: 740 } },
  { name: 'mobile-414', viewport: { width: 414, height: 896 } },
];

const PAGE_OVERFLOW_TOLERANCE_PX = 2;
const WIDGET_OVERFLOW_TOLERANCE_PX = 2;
const SAME_ROW_TOLERANCE_PX = 24;

async function closeWelcomeModalIfPresent(page: Page) {
  const welcomeDialog = page.getByRole('dialog', { name: /welcome to knowsy/i });
  if (!(await welcomeDialog.count())) {
    return;
  }
  if (!(await welcomeDialog.isVisible().catch(() => false))) {
    return;
  }

  const closeButton = welcomeDialog.getByRole('button', { name: /close/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await welcomeDialog.getByRole('button').first().click();
  }
  await welcomeDialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
}

async function signInAndReachDashboard(page: Page) {
  await page.goto(AUTH_URL, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
  await closeWelcomeModalIfPresent(page);

  const emailInput = page.getByPlaceholder('you@example.com').first();
  const passwordInput = page.getByLabel('Password').first();
  await expect(emailInput).toBeVisible({ timeout: 30_000 });
  await expect(passwordInput).toBeVisible({ timeout: 30_000 });

  await emailInput.fill(credentials.email);
  await passwordInput.fill(credentials.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL((url) => url.pathname.includes('/dashboard'), { timeout: 60_000 }).catch(async () => {
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle' });
  });

  await closeWelcomeModalIfPresent(page);
  await expect(page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
  await expect(page.getByText(/my organizations/i)).toBeVisible({ timeout: 30_000 });
}

async function openOrganizationDashboard(page: Page) {
  if (!page.url().includes(`/dashboard/${ORG_SLUG}`)) {
    const directOrgDashboardUrl = `${DASHBOARD_URL}/${ORG_SLUG}`;
    await page.goto(directOrgDashboardUrl, { waitUntil: 'networkidle' }).catch(() => undefined);
  }

  if (!page.url().includes(`/dashboard/${ORG_SLUG}`)) {
    const orgCardHeading = page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 3 }).first();
    await expect(orgCardHeading).toBeVisible({ timeout: 30_000 });

    const cardContainer = orgCardHeading
      .locator('xpath=ancestor::*[contains(@class,"cursor-pointer") or contains(@class,"card")][1]')
      .first();
    if (await cardContainer.count()) {
      await cardContainer.click();
    } else {
      await orgCardHeading.click();
    }
  }

  await page.waitForURL(new RegExp(`/dashboard/${ORG_SLUG}$`, 'i'), { timeout: 60_000 });
  await closeWelcomeModalIfPresent(page);
  await expect(page.getByRole('heading', { name: new RegExp(ORG_NAME, 'i'), level: 1 })).toBeVisible({
    timeout: 30_000,
  });
}

async function openAnalyticsWorkspace(page: Page) {
  const analyticsTab = page.getByRole('tab', { name: /analytics/i }).first();
  await expect(analyticsTab).toBeVisible({ timeout: 30_000 });
  await analyticsTab.click();
  await expect(analyticsTab).toHaveAttribute('aria-selected', /true/i, { timeout: 10_000 });

  const anchorSignals = [
    page.getByText(/total selections/i).first(),
    page.getByText(/top 10 most popular topics/i).first(),
    page.getByText(/engagement trend/i).first(),
    page.getByRole('heading', { name: /no analytics data yet|no games played yet/i }).first(),
  ];

  const start = Date.now();
  while (Date.now() - start < 60_000) {
    for (const signal of anchorSignals) {
      if (await signal.isVisible().catch(() => false)) {
        return;
      }
    }
    await page.waitForTimeout(500);
  }

  throw new Error('Analytics workspace did not render expected content.');
}

function sectionByHeading(page: Page, heading: RegExp): Locator {
  return page
    .locator('section, div')
    .filter({ has: page.getByRole('heading', { name: heading }) })
    .first();
}

async function assertNoPageHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
    };
  });

  expect(metrics.scrollWidth - metrics.viewportWidth).toBeLessThanOrEqual(PAGE_OVERFLOW_TOLERANCE_PX);
}

async function assertWidgetsFitViewport(page: Page) {
  const headings = [
    /total selections/i,
    /unique players/i,
    /custom topics/i,
    /auth players/i,
    /engagement trend/i,
    /topic type usage/i,
    /player type distribution/i,
    /top 10 most popular topics/i,
    /topic categories/i,
  ];

  for (const heading of headings) {
    const section = sectionByHeading(page, heading);
    if (!(await section.count())) {
      continue;
    }

    const box = await section.boundingBox();
    if (!box) {
      continue;
    }

    const viewport = page.viewportSize();
    if (!viewport) {
      throw new Error('Viewport size unavailable.');
    }

    expect(box.x, `${heading} should start inside the viewport.`).toBeGreaterThanOrEqual(-WIDGET_OVERFLOW_TOLERANCE_PX);
    expect(box.x + box.width, `${heading} should end inside the viewport.`).toBeLessThanOrEqual(
      viewport.width + WIDGET_OVERFLOW_TOLERANCE_PX
    );
  }
}

async function assertChartsStackVertically(page: Page) {
  const chartHeadings = [
    /engagement trend/i,
    /topic type usage/i,
    /player type distribution/i,
    /top 10 most popular topics/i,
    /topic categories/i,
  ];

  const rows: Array<{ heading: string; top: number }> = [];
  for (const heading of chartHeadings) {
    const section = sectionByHeading(page, heading);
    if (!(await section.count())) {
      continue;
    }
    const box = await section.boundingBox();
    if (!box) {
      continue;
    }
    rows.push({ heading: heading.source, top: Math.round(box.y) });
  }

  for (let index = 0; index < rows.length - 1; index += 1) {
    const current = rows[index];
    const next = rows[index + 1];
    expect(
      Math.abs(current.top - next.top),
      `Charts should stack vertically on mobile. Offending pair: ${current.heading} and ${next.heading}`
    ).toBeGreaterThan(SAME_ROW_TOLERANCE_PX);
  }
}

async function assertChartContentDoesNotOverflow(page: Page) {
  const chartHeadings = [
    /engagement trend/i,
    /topic type usage/i,
    /player type distribution/i,
    /top 10 most popular topics/i,
    /topic categories/i,
  ];

  for (const heading of chartHeadings) {
    const section = sectionByHeading(page, heading);
    if (!(await section.count())) {
      continue;
    }

    const metrics = await section.evaluate((element) => {
      const allTextLike = Array.from(element.querySelectorAll('text, span, p, div, li'));
      const containerRect = element.getBoundingClientRect();
      const containerOverflow = element.scrollWidth - element.clientWidth;

      const textOverflow = allTextLike.some((node) => {
        const rect = (node as HTMLElement | SVGGraphicsElement).getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return false;
        }
        return rect.right > containerRect.right + 2 || rect.left < containerRect.left - 2;
      });

      return { containerOverflow, textOverflow };
    });

    expect(metrics.containerOverflow, `${heading} container should not overflow horizontally.`).toBeLessThanOrEqual(
      WIDGET_OVERFLOW_TOLERANCE_PX
    );
    expect(metrics.textOverflow, `${heading} labels should not overflow the chart container.`).toBeFalsy();
  }
}

async function assertTableBehavior(page: Page) {
  const tableContainers = await page.locator('table').evaluateAll((tables) =>
    tables.map((table) => {
      let container: HTMLElement | null = table as HTMLElement;
      while (container && container !== document.body) {
        const style = window.getComputedStyle(container);
        if (container.scrollWidth > container.clientWidth || /(auto|scroll)/.test(style.overflowX)) {
          break;
        }
        container = container.parentElement;
      }

      const host = container ?? (table as HTMLElement);
      const style = window.getComputedStyle(host);
      return {
        tableOverflow: (table as HTMLElement).scrollWidth - (table as HTMLElement).clientWidth,
        containerOverflow: host.scrollWidth - host.clientWidth,
        overflowX: style.overflowX,
      };
    })
  );

  for (const container of tableContainers) {
    const allowsInternalScroll = /(auto|scroll)/.test(container.overflowX) || container.containerOverflow > 0;
    const fitsWithoutScroll = container.tableOverflow <= WIDGET_OVERFLOW_TOLERANCE_PX;
    expect(
      fitsWithoutScroll || allowsInternalScroll,
      'Data tables should either fit the viewport, scroll internally, or collapse into a list.'
    ).toBeTruthy();
  }
}

test.describe('Responsive analytics dashboard horizontal layout', () => {
  test.setTimeout(240_000);

  for (const breakpoint of mobileAnalyticsBreakpoints) {
    test(`analytics dashboard avoids horizontal overflow on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await signInAndReachDashboard(page);
      await openOrganizationDashboard(page);
      await openAnalyticsWorkspace(page);

      await assertNoPageHorizontalOverflow(page);
      await assertWidgetsFitViewport(page);
      await assertChartsStackVertically(page);
      await assertChartContentDoesNotOverflow(page);
      await assertTableBehavior(page);
    });
  }
});
