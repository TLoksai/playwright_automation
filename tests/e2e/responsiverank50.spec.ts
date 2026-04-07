import { expect, test } from '@playwright/test';

const landscapeViewport = { width: 812, height: 375 };
const rankedItems = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds'];

function buildRankingMarkup() {
  const itemMarkup = rankedItems
    .map(
      (item, index) => `
        <button
          class="rank-item"
          data-testid="rank-item"
          data-item-index="${index}"
          draggable="true"
          aria-roledescription="sortable"
          type="button"
        >
          <span class="drag-handle" data-testid="drag-handle">::</span>
          <span>${item}</span>
        </button>
      `
    )
    .join('');

  return `
    <main class="ranking-shell">
      <section class="ranking-card">
        <p class="eyebrow">Ranking Phase</p>
        <h1>Order the 5 VIP picks from best to worst</h1>
        <div class="ranking-body">
          <div class="rank-slots" data-testid="rank-slots">
            ${['1st', '2nd', '3rd', '4th', '5th']
              .map(
                (label) => `
                  <div class="rank-row" data-testid="rank-row">
                    <span class="rank-label">${label}</span>
                  </div>
                `
              )
              .join('')}
          </div>
          <div class="rank-list" data-testid="rank-list">${itemMarkup}</div>
        </div>
        <button class="lock-in" data-testid="lock-in-btn" type="button">Lock In</button>
      </section>
    </main>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        overflow: hidden;
      }
      body {
        min-height: 100vh;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #f7f9ff 0%, #edf2ff 100%);
        color: #17203a;
      }
      .ranking-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 4px 8px 4px;
      }
      .ranking-card {
        width: min(100%, 760px);
        background: #fff;
        border-radius: 20px;
        padding: 8px 10px;
        box-shadow: 0 16px 40px rgba(23, 32, 58, 0.12);
      }
      .eyebrow {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6d94;
      }
      h1 {
        margin: 4px 0 0;
        font-size: clamp(16px, 2.4vw, 22px);
        line-height: 1.1;
      }
      .ranking-body {
        margin-top: 8px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 8px;
        align-items: start;
      }
      .rank-slots {
        display: grid;
        gap: 4px;
      }
      .rank-row {
        min-height: 28px;
        display: flex;
        align-items: center;
        border-radius: 12px;
        background: #f5f7ff;
        border: 1px solid #dde3ff;
        padding: 4px 10px;
      }
      .rank-label {
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
      }
      .rank-list {
        display: grid;
        gap: 4px;
      }
      .rank-item {
        width: 100%;
        min-height: 32px;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 1px solid #d8defb;
        border-radius: 12px;
        background: #fff;
        padding: 6px 10px;
        font-weight: 700;
        text-align: left;
        touch-action: none;
      }
      .drag-handle {
        font-weight: 800;
        color: #5f6d94;
        letter-spacing: 0.04em;
        min-height: 15px;
        display: inline-flex;
        align-items: center;
      }
      .lock-in {
        margin-top: 6px;
        width: 100%;
        min-height: 34px;
        border: 0;
        border-radius: 999px;
        background: #2b59ff;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
      }
    </style>
    <script>
      const rankList = document.querySelector('[data-testid="rank-list"]');
      let activeIndex = null;

      function syncSlotLabels() {
        const items = Array.from(document.querySelectorAll('[data-testid="rank-item"]'));
        items.forEach((item, index) => {
          item.setAttribute('data-rank-index', String(index));
        });
      }

      syncSlotLabels();

      rankList?.addEventListener('pointerdown', (event) => {
        const target = event.target.closest('[data-testid="rank-item"]');
        if (!target) return;
        activeIndex = Number(target.getAttribute('data-rank-index'));
      });

      rankList?.addEventListener('pointerup', (event) => {
        const target = event.target.closest('[data-testid="rank-item"]');
        if (!target || activeIndex === null) return;
        const targetIndex = Number(target.getAttribute('data-rank-index'));
        if (targetIndex === activeIndex) {
          activeIndex = null;
          return;
        }

        const items = Array.from(document.querySelectorAll('[data-testid="rank-item"]'));
        const moving = items[activeIndex];
        const anchor = items[targetIndex];
        if (!moving || !anchor || moving === anchor) {
          activeIndex = null;
          return;
        }

        if (activeIndex < targetIndex) {
          anchor.after(moving);
        } else {
          anchor.before(moving);
        }

        syncSlotLabels();
        activeIndex = null;
      });

      document.querySelector('[data-testid="lock-in-btn"]')?.addEventListener('click', () => {
        document.body.innerHTML =
          '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><h1>Selection Submitted</h1></main>';
      });
    </script>
  `;
}

test.describe('Mobile landscape ranking usability', () => {
  test('drag-and-drop ranking remains usable in landscape', async ({ page }) => {
    await page.setViewportSize(landscapeViewport);
    await page.setContent(buildRankingMarkup(), { waitUntil: 'domcontentloaded' });

    const rows = page.getByTestId('rank-row');
    const items = page.getByTestId('rank-item');
    const handles = page.getByTestId('drag-handle');
    const lockInButton = page.getByTestId('lock-in-btn');

    await expect(rows).toHaveCount(5);
    await expect(items).toHaveCount(5);
    await expect(lockInButton).toBeVisible();

    const pageMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      scrollY: window.scrollY,
    }));

    expect(
      pageMetrics.scrollWidth,
      'Ranking interface should not introduce horizontal scroll.'
    ).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

    for (let index = 0; index < 5; index += 1) {
      const row = rows.nth(index);
      const handle = handles.nth(index);
      const label = `${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'}`;

      await expect(row).toContainText(label);

      const rowMetrics = await row.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
      });
      const handleMetrics = await handle.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height };
      });

      expect(rowMetrics.left, `Rank slot ${label} should not be clipped on the left.`).toBeGreaterThanOrEqual(0);
      expect(rowMetrics.right, `Rank slot ${label} should not be clipped on the right.`).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);
      expect(rowMetrics.bottom, `Rank slot ${label} should remain visible without vertical scrolling.`).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      expect(handleMetrics.bottom, `Drag handle ${label} should not be clipped by the browser bottom bar.`).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      expect(handleMetrics.height, `Drag handle ${label} should remain tappable.`).toBeGreaterThanOrEqual(15.5);
    }

    const firstItemText = await items.nth(0).innerText();
    const thirdItem = items.nth(2);
    await thirdItem.dispatchEvent('pointerdown');
    await items.nth(0).dispatchEvent('pointerup');

    await expect(items.nth(0)).not.toContainText(firstItemText);
    await expect(items.nth(0)).toContainText('Hamsters');

    const lockInMetrics = await lockInButton.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, bottom: rect.bottom };
    });

    expect(lockInMetrics.left, 'Lock In button should not be clipped on the left.').toBeGreaterThanOrEqual(0);
    expect(lockInMetrics.right, 'Lock In button should not be clipped on the right.').toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);
    expect(lockInMetrics.bottom, 'Lock In button should be reachable without scrolling.').toBeLessThanOrEqual(pageMetrics.viewportHeight);

    await lockInButton.click();
    await expect(page.getByRole('heading', { name: /selection submitted/i })).toBeVisible();
  });
});
