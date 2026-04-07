import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
];

const topicItems = ['Bunnies', 'Cats', 'Hamsters', 'Dogs'];

function buildTopicSelectionMarkup() {
  const itemMarkup = topicItems
    .map(
      (item, index) => `
        <button class="topic-item" data-testid="topic-item" data-item-index="${index}" type="button">
          <span class="topic-name">${item}</span>
        </button>
      `
    )
    .join('');

  return `
    <main class="topic-shell">
      <section class="topic-card">
        <p class="eyebrow">Topic Selection</p>
        <h1>Select all 4 topic items</h1>
        <p class="helper" data-testid="selection-counter">0 / 4 selected</p>
        <div class="topic-grid" data-testid="topic-grid">${itemMarkup}</div>
        <button class="submit-selection" data-testid="submit-selection-btn" type="button">Submit Selection</button>
      </section>
    </main>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }
      body {
        min-height: 100vh;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #f7f9ff 0%, #edf2ff 100%);
        color: #17203a;
      }
      .topic-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 16px 12px 24px;
      }
      .topic-card {
        width: min(100%, 520px);
        background: #fff;
        border-radius: 20px;
        padding: 16px 14px;
        box-shadow: 0 16px 40px rgba(23, 32, 58, 0.12);
      }
      .eyebrow {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6d94;
      }
      h1 {
        margin: 8px 0 0;
        font-size: clamp(22px, 5vw, 30px);
        line-height: 1.15;
      }
      .helper {
        margin: 10px 0 0;
        font-size: 14px;
        font-weight: 600;
        color: #51607f;
      }
      .topic-grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .topic-item {
        min-height: 54px;
        border: 1px solid #d8defb;
        border-radius: 16px;
        background: #fff;
        padding: 12px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .topic-item.is-selected {
        background: #edf2ff;
        border-color: #2b59ff;
        color: #1f42c4;
      }
      .submit-selection {
        margin-top: 14px;
        width: 100%;
        min-height: 46px;
        border: 0;
        border-radius: 999px;
        background: #2b59ff;
        color: #fff;
        font-size: 15px;
        font-weight: 700;
      }
    </style>
    <script>
      const topicItems = Array.from(document.querySelectorAll('[data-testid="topic-item"]'));
      const counter = document.querySelector('[data-testid="selection-counter"]');

      function syncCounter() {
        const selectedCount = topicItems.filter((item) => item.classList.contains('is-selected')).length;
        if (counter) counter.textContent = selectedCount + ' / 4 selected';
      }

      topicItems.forEach((item) => {
        item.addEventListener('click', () => {
          item.classList.toggle('is-selected');
          syncCounter();
        });
      });

      document.querySelector('[data-testid="submit-selection-btn"]')?.addEventListener('click', () => {
        document.body.innerHTML =
          '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><h1>Selection Submitted</h1></main>';
      });
    </script>
  `;
}

test.describe('Multiple topic selection responsiveness', () => {
  for (const breakpoint of breakpoints) {
    test(`script selects all 4 topic items on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildTopicSelectionMarkup(), { waitUntil: 'domcontentloaded' });

      const items = page.getByTestId('topic-item');
      const counter = page.getByTestId('selection-counter');
      const submitButton = page.getByTestId('submit-selection-btn');

      await expect(items).toHaveCount(4);
      await expect(submitButton).toBeVisible();

      const pageMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
      }));

      expect(
        pageMetrics.scrollWidth,
        'Topic selection should not introduce page-level horizontal overflow.'
      ).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

      for (let index = 0; index < 4; index += 1) {
        const item = items.nth(index);
        await expect(item).toContainText(topicItems[index]);
        await item.click();
        await expect(item).toHaveClass(/is-selected/);
      }

      await expect(counter).toHaveText('4 / 4 selected');

      for (let index = 0; index < 4; index += 1) {
        const itemMetrics = await items.nth(index).evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            height: rect.height,
          };
        });

        expect(itemMetrics.left, `Topic item ${index + 1} should not be clipped on the left.`).toBeGreaterThanOrEqual(0);
        expect(itemMetrics.right, `Topic item ${index + 1} should not be clipped on the right.`).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);
        expect(itemMetrics.height, `Topic item ${index + 1} should remain tappable.`).toBeGreaterThanOrEqual(44);
        expect(itemMetrics.bottom, `Topic item ${index + 1} should remain visible within the viewport.`).toBeLessThanOrEqual(breakpoint.viewport.height);
      }

      const submitMetrics = await submitButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        };
      });

      expect(submitMetrics.left, 'Submit Selection should not be clipped on the left.').toBeGreaterThanOrEqual(0);
      expect(submitMetrics.right, 'Submit Selection should not be clipped on the right.').toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);
      expect(submitMetrics.bottom, 'Submit Selection should remain reachable without scrolling.').toBeLessThanOrEqual(breakpoint.viewport.height);

      await submitButton.click();
      await expect(page.getByRole('heading', { name: /selection submitted/i })).toBeVisible();
    });
  }
});
