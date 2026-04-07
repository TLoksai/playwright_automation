import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
  { name: 'mobile-large', viewport: { width: 414, height: 896 } },
];

const customItemName = 'UltraAmazingCustomTopicItemXYZ';

function buildCustomItemMarkup() {
  return `
    <main class="topic-shell">
      <section class="topic-card">
        <p class="eyebrow">Topic Selection</p>
        <h1>Add a custom item</h1>
        <p class="helper">Type a custom topic item name and submit it.</p>
        <div class="custom-form" data-testid="custom-form">
          <label class="custom-label" for="custom-item-input">Type custom item name</label>
          <input
            id="custom-item-input"
            class="custom-input"
            data-testid="custom-item-input"
            type="text"
            maxlength="64"
            placeholder="Type custom item name"
          />
          <button class="submit-btn" data-testid="custom-submit-btn" type="button">Submit</button>
        </div>
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
        padding: 16px 14px 24px;
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
        line-height: 1.45;
        color: #51607f;
      }
      .custom-form {
        margin-top: 18px;
        display: grid;
        gap: 10px;
      }
      .custom-label {
        font-size: 14px;
        font-weight: 700;
      }
      .custom-input {
        width: 100%;
        min-height: 48px;
        border: 1px solid #d8defb;
        border-radius: 14px;
        padding: 12px 14px;
        font-size: 16px;
        font-weight: 600;
        color: #17203a;
        background: #fff;
      }
      .submit-btn {
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
      const input = document.querySelector('[data-testid="custom-item-input"]');
      input?.addEventListener('focus', () => {
        document.body.style.paddingBottom = '280px';
        input.scrollIntoView({ block: 'center' });
      });
      input?.addEventListener('blur', () => {
        document.body.style.paddingBottom = '0px';
      });
      document.querySelector('[data-testid="custom-submit-btn"]')?.addEventListener('click', () => {
        document.body.innerHTML =
          '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><h1>Custom Item Submitted</h1></main>';
      });
    </script>
  `;
}

test.describe('Custom item input responsiveness', () => {
  for (const breakpoint of breakpoints) {
    test(`custom input stays usable without horizontal scroll on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildCustomItemMarkup(), { waitUntil: 'domcontentloaded' });

      const input = page.getByTestId('custom-item-input');
      const submitButton = page.getByTestId('custom-submit-btn');

      await expect(input).toBeVisible();
      await expect(submitButton).toBeVisible();

      await input.click();

      const focusedMetrics = await input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          viewportHeight: window.innerHeight,
        };
      });

      expect(
        focusedMetrics.top,
        'Input field should scroll into view when the keyboard opens.'
      ).toBeGreaterThanOrEqual(0);
      expect(
        focusedMetrics.bottom,
        'Input field should remain within the visible viewport when focused.'
      ).toBeLessThanOrEqual(focusedMetrics.viewportHeight);

      await input.fill(customItemName);
      await expect(input).toHaveValue(customItemName);

      const afterMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0
        ),
      }));

      const inputMetrics = await input.evaluate((element: HTMLInputElement) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          visibleTextLength: element.value.length,
          scrollLeft: element.scrollLeft,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        };
      });

      const submitMetrics = await submitButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          viewportHeight: window.innerHeight,
        };
      });

      expect(
        afterMetrics.scrollWidth,
        'Soft-keyboard interaction should not introduce horizontal page scroll.'
      ).toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(inputMetrics.left, 'Custom input should not be clipped on the left.').toBeGreaterThanOrEqual(0);
      expect(inputMetrics.right, 'Custom input should not be clipped on the right.').toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(inputMetrics.visibleTextLength, 'Typed text should remain present in the field.').toBe(customItemName.length);
      expect(
        inputMetrics.scrollWidth,
        'Typed text should remain fully visible in the input field.'
      ).toBeLessThanOrEqual(inputMetrics.clientWidth + inputMetrics.scrollLeft + 1);
      expect(submitMetrics.left, 'Submit button should not be clipped on the left.').toBeGreaterThanOrEqual(0);
      expect(submitMetrics.right, 'Submit button should not be clipped on the right.').toBeLessThanOrEqual(afterMetrics.viewportWidth + 2);
      expect(
        submitMetrics.bottom,
        'Submit button should remain reachable above or within the keyboard area.'
      ).toBeLessThanOrEqual(submitMetrics.viewportHeight);

      await submitButton.click();
      await expect(page.getByRole('heading', { name: /custom item submitted/i })).toBeVisible();
    });
  }
});
