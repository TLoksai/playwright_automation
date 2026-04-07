import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
];

const topicItems = ['Bunnies', 'Cats', 'Hamsters', 'Dogs'];

function buildTopicCardMarkup() {
  const itemMarkup = topicItems
    .map(
      (item, index) => `
        <button
          class="topic-item ${index % 2 === 0 ? 'is-selected' : ''}"
          data-testid="topic-item"
          data-item-index="${index}"
          type="button"
        >
          <span class="topic-name" data-testid="topic-name">${item}</span>
          <span class="topic-state" data-testid="topic-state">${index % 2 === 0 ? 'Selected' : 'Available'}</span>
        </button>
      `
    )
    .join('');

  return `
    <main class="topic-shell">
      <section class="topic-card">
        <p class="eyebrow">Topic Selection</p>
        <h1>Inspect topic card readability</h1>
        <div class="topic-grid" data-testid="topic-grid">${itemMarkup}</div>
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
      .topic-grid {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .topic-item {
        min-height: 68px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        gap: 4px;
        border: 1px solid #d8defb;
        border-radius: 16px;
        background: #fff;
        padding: 12px;
        text-align: left;
      }
      .topic-item.is-selected {
        background: #edf2ff;
        border-color: #2b59ff;
      }
      .topic-name {
        font-size: 16px;
        line-height: 1.25;
        font-weight: 800;
        overflow-wrap: anywhere;
      }
      .topic-state {
        font-size: 13px;
        line-height: 1.2;
        font-weight: 700;
        color: #5a6787;
      }
      .topic-item.is-selected .topic-state {
        color: #1f42c4;
      }
    </style>
  `;
}

test.describe('Topic card text readability', () => {
  for (const breakpoint of breakpoints) {
    test(`selected and unselected topic cards remain readable on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildTopicCardMarkup(), { waitUntil: 'domcontentloaded' });

      const cards = page.getByTestId('topic-item');
      await expect(cards).toHaveCount(4);

      const pageMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
      }));

      expect(
        pageMetrics.scrollWidth,
        'Topic card layout should not introduce horizontal overflow.'
      ).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

      for (let index = 0; index < 4; index += 1) {
        const card = cards.nth(index);
        const expectedName = topicItems[index];
        const expectedState = index % 2 === 0 ? 'Selected' : 'Available';

        await expect(card).toContainText(expectedName);
        await expect(card).toContainText(expectedState);

        const metrics = await card.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const name = element.querySelector('[data-testid="topic-name"]') as HTMLElement | null;
          const state = element.querySelector('[data-testid="topic-state"]') as HTMLElement | null;
          const nameStyle = name ? window.getComputedStyle(name) : null;
          const stateStyle = state ? window.getComputedStyle(state) : null;

          const parseColor = (value: string | null | undefined) => {
            if (!value) return null;
            const match = value.match(/\d+(\.\d+)?/g);
            return match ? match.map(Number) : null;
          };

          const luminance = (rgb: number[] | null) => {
            if (!rgb || rgb.length < 3) return null;
            const [r, g, b] = rgb.slice(0, 3).map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.03928
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };

          const contrast = (foreground: string | null | undefined, background: string | null | undefined) => {
            const fg = luminance(parseColor(foreground));
            const bg = luminance(parseColor(background));
            if (fg === null || bg === null) return null;
            const lighter = Math.max(fg, bg);
            const darker = Math.min(fg, bg);
            return (lighter + 0.05) / (darker + 0.05);
          };

          return {
            left: rect.left,
            right: rect.right,
            height: rect.height,
            nameTextOverflow: name ? name.scrollWidth - name.clientWidth : 0,
            stateTextOverflow: state ? state.scrollWidth - state.clientWidth : 0,
            nameFontSize: nameStyle ? Number.parseFloat(nameStyle.fontSize) : 0,
            stateFontSize: stateStyle ? Number.parseFloat(stateStyle.fontSize) : 0,
            nameContrast: contrast(nameStyle?.color, window.getComputedStyle(element).backgroundColor),
            stateContrast: contrast(stateStyle?.color, window.getComputedStyle(element).backgroundColor),
          };
        });

        expect(metrics.left, `Topic card ${index + 1} should not be clipped on the left.`).toBeGreaterThanOrEqual(0);
        expect(metrics.right, `Topic card ${index + 1} should not be clipped on the right.`).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);
        expect(metrics.height, `Topic card ${index + 1} should remain readable.`).toBeGreaterThanOrEqual(60);
        expect(metrics.nameTextOverflow, `Topic card ${index + 1} title should not be cut off.`).toBeLessThanOrEqual(1);
        expect(metrics.stateTextOverflow, `Topic card ${index + 1} state label should not be cut off.`).toBeLessThanOrEqual(1);
        expect(metrics.nameFontSize, `Topic card ${index + 1} title should use a readable font size.`).toBeGreaterThanOrEqual(15);
        expect(metrics.stateFontSize, `Topic card ${index + 1} state label should use a readable font size.`).toBeGreaterThanOrEqual(12);
        expect(metrics.nameContrast ?? 0, `Topic card ${index + 1} title should have sufficient contrast.`).toBeGreaterThanOrEqual(4.5);
        expect(metrics.stateContrast ?? 0, `Topic card ${index + 1} state label should have sufficient contrast.`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
