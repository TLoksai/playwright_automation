import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-320', viewport: { width: 320, height: 640 } },
  { name: 'mobile-360', viewport: { width: 360, height: 740 } },
  { name: 'mobile-375', viewport: { width: 375, height: 812 } },
];

const revealRows = [
  { label: '1st', item: 'Bunnies', delta: '+2', deltaClass: 'delta-positive-large' },
  { label: '2nd', item: 'Cats', delta: '+1', deltaClass: 'delta-positive' },
  { label: '3rd', item: 'Hamsters', delta: '-1', deltaClass: 'delta-negative' },
  { label: '4th', item: 'Dogs', delta: '+1', deltaClass: 'delta-positive' },
  { label: '5th', item: 'Birds', delta: '+2', deltaClass: 'delta-positive-large' },
];

function buildScoreRevealMarkup() {
  const cardsMarkup = revealRows
    .map(
      (row, index) => `
        <article class="result-card" data-testid="result-card" data-card-index="${index}">
          <div class="result-copy">
            <p class="rank-label" data-testid="rank-label">${row.label}</p>
            <h2 class="item-name" data-testid="item-name">${row.item}</h2>
          </div>
          <span
            class="score-badge ${row.deltaClass}"
            data-testid="score-badge"
            data-delta="${row.delta}"
            aria-label="score change ${row.delta}"
          >
            ${row.delta}
          </span>
        </article>
      `
    )
    .join('');

  return `
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <main class="reveal-shell">
      <section class="reveal-panel">
        <p class="eyebrow">Score Reveal</p>
        <h1 data-testid="reveal-heading">Guesses locked. Reveal the score deltas.</h1>
        <p class="support-copy" data-testid="reveal-copy">Each scored item stacks vertically so every player can review the changes without horizontal scrolling.</p>
        <div class="result-stack" data-testid="result-stack">${cardsMarkup}</div>
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
      .reveal-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 14px 10px 20px;
      }
      .reveal-panel {
        width: min(100%, 520px);
        background: #ffffff;
        border-radius: 20px;
        padding: 16px 12px 18px;
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
        margin: 8px 0 0;
        font-size: clamp(21px, 6vw, 30px);
        line-height: 1.15;
      }
      .support-copy {
        margin: 10px 0 0;
        font-size: 14px;
        line-height: 1.45;
        color: #50607d;
      }
      .result-stack {
        margin-top: 16px;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
      }
      .result-card {
        width: 100%;
        min-height: 72px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 12px;
        border-radius: 18px;
        border: 1px solid #d8defb;
        background: #f7f9ff;
        overflow: hidden;
      }
      .result-copy {
        min-width: 0;
        display: grid;
        gap: 4px;
      }
      .rank-label {
        margin: 0;
        font-size: 13px;
        font-weight: 800;
        color: #44557c;
        white-space: nowrap;
      }
      .item-name {
        margin: 0;
        min-width: 0;
        font-size: clamp(16px, 4.4vw, 20px);
        line-height: 1.2;
        overflow-wrap: anywhere;
      }
      .score-badge {
        min-width: 52px;
        min-height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 16px;
        font-weight: 800;
        white-space: nowrap;
        transform: scale(0.9);
        opacity: 0.96;
        transition: transform 160ms ease-out, opacity 160ms ease-out;
        will-change: transform;
      }
      .score-badge.is-revealed {
        transform: scale(1);
        opacity: 1;
      }
      .delta-positive-large {
        background: #dff6e7;
        color: #0d6b35;
      }
      .delta-positive {
        background: #e8f0ff;
        color: #2148a6;
      }
      .delta-negative {
        background: #fde9e7;
        color: #b1342a;
      }
    </style>
    <script>
      window.startBadgeReveal = () => {
        const badges = Array.from(document.querySelectorAll('[data-testid="score-badge"]'));
        badges.forEach((badge) => badge.classList.add('is-revealed'));
      };
    </script>
  `;
}

async function readBox(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  });
}

test.describe('VIP score delta reveal responsiveness', () => {
  for (const breakpoint of breakpoints) {
    test(`score delta cards stay visible without horizontal overflow on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildScoreRevealMarkup(), { waitUntil: 'domcontentloaded' });

      const cards = page.getByTestId('result-card');
      const badges = page.getByTestId('score-badge');

      await expect(cards).toHaveCount(revealRows.length);
      await expect(badges).toHaveCount(revealRows.length);

      const pageMetricsBefore = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      }));

      expect(pageMetricsBefore.scrollWidth).toBeLessThanOrEqual(pageMetricsBefore.viewportWidth + 2);

      const firstCardBoxBefore = await readBox(cards.first());
      const layoutSnapshotBefore = await Promise.all(
        Array.from({ length: revealRows.length }, (_, index) => readBox(cards.nth(index)))
      );

      for (let index = 0; index < revealRows.length; index += 1) {
        const card = cards.nth(index);
        const badge = badges.nth(index);
        const cardBox = layoutSnapshotBefore[index];
        const badgeBox = await readBox(badge);

        expect(cardBox.left, `Card ${index + 1} should not clip on the left.`).toBeGreaterThanOrEqual(0);
        expect(cardBox.right, `Card ${index + 1} should not clip on the right.`).toBeLessThanOrEqual(pageMetricsBefore.viewportWidth + 2);
        expect(cardBox.width, `Card ${index + 1} should stack as a full-width vertical row.`).toBeGreaterThanOrEqual(pageMetricsBefore.viewportWidth - 48);
        expect(badgeBox.right, `Badge ${index + 1} should remain fully visible.`).toBeLessThanOrEqual(cardBox.right - 8);
        expect(badgeBox.left, `Badge ${index + 1} should remain inside the card.`).toBeGreaterThanOrEqual(cardBox.left + 8);
        await expect(card).toContainText(revealRows[index].label);
        await expect(badge).toContainText(revealRows[index].delta);

        if (index > 0) {
          expect(cardBox.top, `Card ${index + 1} should stack below the previous card.`).toBeGreaterThan(layoutSnapshotBefore[index - 1].bottom - 2);
        }
      }

      await page.evaluate(() => {
        // Trigger the score badge animation without changing the card layout.
        window.startBadgeReveal();
      });

      await page.waitForTimeout(220);

      const pageMetricsAfter = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      }));

      expect(pageMetricsAfter.scrollWidth).toBeLessThanOrEqual(pageMetricsAfter.viewportWidth + 2);

      for (let index = 0; index < revealRows.length; index += 1) {
        const cardBoxAfter = await readBox(cards.nth(index));
        const badgeBoxAfter = await readBox(badges.nth(index));
        const cardBoxBefore = layoutSnapshotBefore[index];

        expect(Math.abs(cardBoxAfter.left - cardBoxBefore.left), `Card ${index + 1} should not shift horizontally during animation.`).toBeLessThanOrEqual(1);
        expect(Math.abs(cardBoxAfter.top - cardBoxBefore.top), `Card ${index + 1} should not reflow vertically during animation.`).toBeLessThanOrEqual(1);
        expect(Math.abs(cardBoxAfter.width - cardBoxBefore.width), `Card ${index + 1} width should stay stable during animation.`).toBeLessThanOrEqual(1);
        expect(badgeBoxAfter.right, `Badge ${index + 1} should remain inside the viewport after reveal.`).toBeLessThanOrEqual(pageMetricsAfter.viewportWidth - 10);
      }

      const firstCardBoxAfter = await readBox(cards.first());
      expect(Math.abs(firstCardBoxAfter.left - firstCardBoxBefore.left)).toBeLessThanOrEqual(1);
    });
  }
});
