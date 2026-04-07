import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
];

const topicItems = [
  'Bunnies',
  'Cats',
  'Hamsters',
  'Dogs',
  'Birds',
  'Fish',
  'Turtles',
  'Lizards',
  'Rabbits',
  'Guinea Pigs',
  'Chinchillas',
  'Parrots',
];

function buildPreviewMarkup() {
  const itemMarkup = topicItems
    .map(
      (item, index) =>
        `<li class="topic-item" data-testid="topic-item">${index + 1}. ${item}</li>`
    )
    .join('');

  return `
    <main class="topic-preview-shell" data-testid="topic-preview-shell">
      <section class="preview-card" data-testid="topic-preview-card">
        <p class="eyebrow">VIP Topic Preview</p>
        <h1>Preview all candidate items before selecting</h1>
        <p class="helper">Scroll the list below to review every available option.</p>
        <div class="preview-list-frame">
          <div class="scroll-indicator" data-testid="preview-scroll-indicator">Scroll for more</div>
          <div class="preview-list" data-testid="topic-preview-list" role="region" aria-label="Topic preview list">
            <ol class="preview-items">
              ${itemMarkup}
            </ol>
          </div>
        </div>
        <button class="start-selecting" data-testid="start-selecting-btn" type="button">Start Selecting</button>
      </section>
    </main>
    <style>
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        overflow-x: hidden;
      }
      body {
        min-height: 100vh;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #f6f8ff 0%, #eef3ff 100%);
        color: #17203a;
      }
      .topic-preview-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 16px 12px 24px;
      }
      .preview-card {
        width: min(100%, 520px);
        background: #ffffff;
        border-radius: 20px;
        padding: 18px 14px 16px;
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
        margin: 10px 0 0;
        font-size: clamp(24px, 6vw, 34px);
        line-height: 1.1;
      }
      .helper {
        margin: 10px 0 0;
        font-size: 14px;
        line-height: 1.4;
        color: #55627f;
      }
      .preview-list-frame {
        margin-top: 16px;
        position: relative;
      }
      .scroll-indicator {
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 2;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(43, 89, 255, 0.12);
        color: #2346cb;
      }
      .preview-list {
        height: min(44vh, 320px);
        overflow-y: auto;
        overflow-x: hidden;
        padding: 12px;
        border-radius: 16px;
        background: #f4f6ff;
        border: 1px solid #dfe5ff;
        scrollbar-width: thin;
      }
      .preview-list::-webkit-scrollbar {
        width: 8px;
      }
      .preview-list::-webkit-scrollbar-thumb {
        background: #9db1ff;
        border-radius: 999px;
      }
      .preview-items {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 10px;
      }
      .topic-item {
        min-height: 48px;
        display: flex;
        align-items: center;
        padding: 12px 14px;
        border-radius: 14px;
        background: #ffffff;
        border: 1px solid #d7defa;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .start-selecting {
        margin-top: 16px;
        width: 100%;
        min-height: 46px;
        border: 0;
        border-radius: 999px;
        background: #2b59ff;
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
      }
    </style>
    <script>
      document.querySelector('[data-testid="start-selecting-btn"]')?.addEventListener('click', () => {
        document.body.innerHTML = '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><h1>Topic Selection</h1></main>';
      });
    </script>
  `;
}

test.describe('Topic preview internal scrolling', () => {
  for (const breakpoint of breakpoints) {
    test(`topic preview list scrolls internally on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildPreviewMarkup(), { waitUntil: 'domcontentloaded' });

      const previewList = page.getByTestId('topic-preview-list');
      const scrollIndicator = page.getByTestId('preview-scroll-indicator');
      const startSelectingButton = page.getByTestId('start-selecting-btn');

      await expect(previewList).toBeVisible();
      await expect(scrollIndicator).toBeVisible();
      await expect(startSelectingButton).toBeVisible();

      const beforeMetrics = await page.evaluate(() => ({
        scrollX: window.scrollX,
        viewportWidth: window.innerWidth,
        bodyScrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
      }));

      const listMetrics = await previewList.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          overflowY: style.overflowY,
          overflowX: style.overflowX,
          initialScrollTop: element.scrollTop,
        };
      });

      expect(listMetrics.scrollHeight, 'Preview list should contain enough items to scroll internally.').toBeGreaterThan(listMetrics.clientHeight);
      expect(listMetrics.overflowY, 'Preview list should enable internal vertical scrolling.').toMatch(/auto|scroll/);
      expect(listMetrics.overflowX, 'Preview list should not scroll horizontally.').toMatch(/hidden|clip|auto/);

      await previewList.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });

      const afterListMetrics = await previewList.evaluate((element) => ({
        scrollTop: element.scrollTop,
        maxScrollTop: element.scrollHeight - element.clientHeight,
      }));

      expect(afterListMetrics.scrollTop, 'Preview list should scroll internally through all items.').toBeGreaterThan(0);
      expect(afterListMetrics.scrollTop, 'Preview list should reach the lower portion of the list.').toBeGreaterThanOrEqual(afterListMetrics.maxScrollTop - 8);

      const afterMetrics = await page.evaluate(() => ({
        scrollX: window.scrollX,
        viewportWidth: window.innerWidth,
        bodyScrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
      }));

      const buttonMetrics = await startSelectingButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
        };
      });

      expect(
        Math.round(afterMetrics.scrollX),
        'Page body should not scroll horizontally while the preview list scrolls.'
      ).toBe(Math.round(beforeMetrics.scrollX));
      expect(
        afterMetrics.bodyScrollWidth,
        'Page body should not introduce horizontal overflow.'
      ).toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(
        buttonMetrics.bottom,
        'Start Selecting button should remain above the fold.'
      ).toBeLessThanOrEqual(breakpoint.viewport.height);

      await startSelectingButton.click();
      await expect(page.getByRole('heading', { name: /topic selection/i })).toBeVisible();
    });
  }
});
