import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
];

const items = ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds'];
const slotLabels = ['1st', '2nd', '3rd', '4th', '5th'];

function buildGuessingMarkup() {
  const slotMarkup = slotLabels
    .map(
      (label, index) => `
        <button class="rank-slot" data-testid="rank-slot" data-slot-index="${index}" type="button">
          <span class="slot-label">${label}</span>
          <span class="slot-value" data-testid="slot-value">Empty</span>
        </button>
      `
    )
    .join('');

  const itemMarkup = items
    .map(
      (item, index) => `
        <button class="guess-item" data-testid="guess-item" data-item-index="${index}" type="button">
          ${item}
        </button>
      `
    )
    .join('');

  return `
    <main class="guess-shell">
      <section class="guess-card">
        <p class="eyebrow">Guessing Phase</p>
        <h1>Rank the VIP choices from 1st to 5th</h1>
        <div class="slots" data-testid="rank-slots">${slotMarkup}</div>
        <div class="items" data-testid="guess-items">${itemMarkup}</div>
        <button class="lock-in" data-testid="lock-in-btn" type="button">Lock In</button>
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
        background: linear-gradient(180deg, #f8f9ff 0%, #eef2ff 100%);
        color: #17203a;
      }
      .guess-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 16px 12px 24px;
      }
      .guess-card {
        width: min(100%, 520px);
        background: #fff;
        border-radius: 20px;
        padding: 14px 12px 14px;
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
        font-size: clamp(20px, 5vw, 30px);
        line-height: 1.15;
      }
      .slots {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }
      .rank-slot {
        width: 100%;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border: 1px solid #d8defb;
        border-radius: 16px;
        background: #f6f8ff;
        color: #17203a;
      }
      .rank-slot.is-filled {
        border-color: #2b59ff;
        background: #edf2ff;
      }
      .slot-label {
        font-weight: 800;
        white-space: nowrap;
      }
      .slot-value {
        flex: 1;
        text-align: right;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .items {
        margin-top: 12px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .guess-item {
        min-height: 40px;
        border: 1px solid #d8defb;
        border-radius: 14px;
        background: #ffffff;
        font-weight: 700;
        padding: 8px 10px;
      }
      .guess-item.is-used {
        opacity: 0.6;
      }
      .lock-in {
        margin-top: 12px;
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
      const slots = Array.from(document.querySelectorAll('[data-testid="rank-slot"]'));
      const guessItems = Array.from(document.querySelectorAll('[data-testid="guess-item"]'));
      let activeItem = null;

      guessItems.forEach((item) => {
        item.addEventListener('click', () => {
          activeItem = item;
        });
      });

      slots.forEach((slot) => {
        slot.addEventListener('click', () => {
          if (!activeItem) return;
          slot.classList.add('is-filled');
          const value = slot.querySelector('[data-testid="slot-value"]');
          if (value) value.textContent = activeItem.textContent?.trim() || 'Filled';
          activeItem.classList.add('is-used');
          activeItem = null;
        });
      });
    </script>
  `;
}

test.describe('Guesser rank slots responsiveness', () => {
  for (const breakpoint of breakpoints) {
    test(`rank slots 1st-5th stay visible and tappable on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildGuessingMarkup(), { waitUntil: 'domcontentloaded' });

      const slots = page.getByTestId('rank-slot');
      const guessItems = page.getByTestId('guess-item');
      const lockInButton = page.getByTestId('lock-in-btn');

      await expect(slots).toHaveCount(5);
      await expect(guessItems).toHaveCount(5);
      await expect(lockInButton).toBeVisible();

      const beforeMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
        scrollX: window.scrollX,
      }));

      expect(
        beforeMetrics.scrollWidth,
        'Guessing phase should not introduce page-level horizontal overflow.'
      ).toBeLessThanOrEqual(beforeMetrics.viewportWidth + 2);

      for (let index = 0; index < 5; index += 1) {
        const slot = slots.nth(index);
        const item = guessItems.nth(index);
        const expectedLabel = slotLabels[index];
        const expectedItem = items[index];

        await expect(slot).toContainText(expectedLabel);
        await expect(slot).toContainText(/empty/i);

        const slotMetrics = await slot.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        });

        expect(slotMetrics.left, `Rank slot ${expectedLabel} should not be clipped on the left.`).toBeGreaterThanOrEqual(0);
        expect(slotMetrics.right, `Rank slot ${expectedLabel} should not be clipped on the right.`).toBeLessThanOrEqual(beforeMetrics.viewportWidth + 2);
        expect(slotMetrics.width, `Rank slot ${expectedLabel} should fit within the viewport width.`).toBeLessThanOrEqual(beforeMetrics.viewportWidth);
        expect(slotMetrics.height, `Rank slot ${expectedLabel} should remain readable and tappable.`).toBeGreaterThanOrEqual(44);

        await item.click();
        await slot.click();
        await expect(slot).toContainText(expectedItem);
      }

      const afterMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
        scrollX: window.scrollX,
      }));

      const lockInMetrics = await lockInButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
        };
      });

      expect(
        Math.round(afterMetrics.scrollX),
        'Tapping rank slots should not cause page-level horizontal scroll.'
      ).toBe(Math.round(beforeMetrics.scrollX));
      expect(
        afterMetrics.scrollWidth,
        'Page body should remain free of horizontal overflow after slot assignment.'
      ).toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(lockInMetrics.left, 'Lock In CTA should not be clipped on the left.').toBeGreaterThanOrEqual(0);
      expect(lockInMetrics.right, 'Lock In CTA should not be clipped on the right.').toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(lockInMetrics.bottom, 'Lock In CTA should remain visible without scrolling.').toBeLessThanOrEqual(breakpoint.viewport.height);
    });
  }
});
