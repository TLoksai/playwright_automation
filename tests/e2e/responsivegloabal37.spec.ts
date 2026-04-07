import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'iphone-landscape', viewport: { width: 812, height: 375 } },
  { name: 'pixel-landscape', viewport: { width: 915, height: 412 } },
];

function buildLandscapeFlowMarkup() {
  return `
    <main class="app-shell">
      <section class="screen landing-screen" data-testid="landing-screen">
        <div class="hero-copy">
          <p class="eyebrow">Landing</p>
          <h1 data-testid="landing-title">Play social ranking rounds with friends</h1>
          <p class="body-copy" data-testid="landing-copy">Create a room, preview topics, rank choices, and lock in your picks.</p>
        </div>
        <button class="primary-btn" data-testid="play-now-btn" type="button">Play Now</button>
      </section>

      <section class="screen waiting-screen hidden" data-testid="waiting-screen">
        <div class="screen-header">
          <p class="eyebrow">Waiting for Players</p>
          <p class="room-code" data-testid="room-code">ROOM123PLAY</p>
          <h2 data-testid="players-heading">Players (2/6)</h2>
        </div>
        <div class="content-columns">
          <div class="card-stack">
            <div class="info-card" data-testid="player-card">Host Player</div>
            <div class="info-card" data-testid="player-card">AI Player</div>
          </div>
          <div class="action-stack">
            <button class="secondary-btn" data-testid="add-ai-btn" type="button">Add AI Player</button>
            <button class="primary-btn compact-btn" data-testid="start-game-btn" type="button">Start Game</button>
          </div>
        </div>
      </section>

      <section class="screen topic-screen hidden" data-testid="topic-screen">
        <div class="screen-header">
          <p class="eyebrow">Topic Selection</p>
          <h2 data-testid="topic-heading">Round 1 - Topic Selection</h2>
        </div>
        <div class="content-columns">
          <div class="card-grid" data-testid="topic-grid">
            <button class="topic-card" data-testid="topic-card" type="button">Bunnies</button>
            <button class="topic-card" data-testid="topic-card" type="button">Cats</button>
            <button class="topic-card" data-testid="topic-card" type="button">Hamsters</button>
            <button class="topic-card" data-testid="topic-card" type="button">Dogs</button>
          </div>
          <div class="side-actions">
            <button class="primary-btn compact-btn" data-testid="preview-btn" type="button">Preview Topic</button>
          </div>
        </div>
      </section>

      <div class="dialog-backdrop hidden" data-testid="preview-dialog">
        <div class="dialog-card" role="dialog" aria-modal="true">
          <div class="dialog-layout">
            <div class="dialog-copy">
              <h3 data-testid="dialog-title">VIP Topic Preview</h3>
              <div class="dialog-list">
                <div class="dialog-item">1. Bunnies</div>
                <div class="dialog-item">2. Cats</div>
                <div class="dialog-item">3. Hamsters</div>
                <div class="dialog-item">4. Dogs</div>
                <div class="dialog-item">5. Birds</div>
              </div>
            </div>
            <div class="dialog-actions">
              <button class="primary-btn compact-btn" data-testid="start-selecting-btn" type="button">Start Selecting</button>
            </div>
          </div>
        </div>
      </div>

      <section class="screen guess-screen hidden" data-testid="guess-screen">
        <div class="screen-header">
          <p class="eyebrow">Guessing Phase</p>
          <h2 data-testid="guess-heading">Rank the VIP choices</h2>
        </div>
        <div class="content-columns">
          <div class="rank-grid">
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">1st</span><span class="rank-value">Bunnies</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">2nd</span><span class="rank-value">Cats</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">3rd</span><span class="rank-value">Hamsters</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">4th</span><span class="rank-value">Dogs</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">5th</span><span class="rank-value">Birds</span></div>
          </div>
          <div class="side-actions">
            <button class="primary-btn compact-btn" data-testid="lock-in-btn" type="button">Lock In</button>
          </div>
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
      .app-shell {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 8px 10px 10px;
      }
      .screen {
        width: min(100%, 920px);
        background: #fff;
        border-radius: 20px;
        padding: 12px;
        box-shadow: 0 16px 40px rgba(23, 32, 58, 0.12);
      }
      .hidden { display: none !important; }
      .eyebrow {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6d94;
      }
      h1, h2, h3 {
        margin: 4px 0 0;
        line-height: 1.1;
      }
      h1 { font-size: clamp(18px, 3vw, 30px); }
      h2 { font-size: clamp(17px, 2.6vw, 26px); }
      h3 { font-size: clamp(16px, 2.4vw, 24px); }
      .body-copy {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.35;
        color: #50607d;
      }
      .screen-header {
        display: grid;
        gap: 4px;
      }
      .hero-copy {
        display: grid;
        gap: 4px;
      }
      .content-columns,
      .dialog-layout,
      .landing-screen {
        margin-top: 10px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
        gap: 10px;
        align-items: start;
      }
      .primary-btn,
      .secondary-btn {
        width: 100%;
        min-height: 38px;
        border: 0;
        border-radius: 999px;
        font-weight: 700;
        padding: 10px 14px;
      }
      .primary-btn {
        background: #2b59ff;
        color: #fff;
      }
      .secondary-btn {
        background: #edf1ff;
        color: #25375e;
      }
      .compact-btn {
        margin-top: 0;
      }
      .room-code {
        margin: 0;
        font-size: clamp(18px, 3vw, 28px);
        font-weight: 800;
      }
      .card-stack,
      .action-stack,
      .rank-grid,
      .dialog-list {
        display: grid;
        gap: 8px;
      }
      .side-actions,
      .dialog-actions {
        display: grid;
        gap: 8px;
      }
      .info-card,
      .rank-card,
      .topic-card,
      .dialog-item {
        border: 1px solid #d8defb;
        border-radius: 14px;
        background: #f7f9ff;
      }
      .info-card {
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        font-weight: 600;
      }
      .card-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }
      .topic-card {
        min-height: 44px;
        padding: 10px;
        font-weight: 700;
      }
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(14, 20, 37, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
      }
      .dialog-card {
        width: min(100%, 760px);
        max-height: min(86vh, 320px);
        overflow: auto;
        background: #fff;
        border-radius: 20px;
        padding: 12px;
        box-shadow: 0 20px 50px rgba(18, 26, 47, 0.2);
      }
      .dialog-item {
        min-height: 36px;
        display: flex;
        align-items: center;
        padding: 8px 10px;
        font-weight: 600;
      }
      .rank-card {
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 10px;
      }
      .rank-label {
        font-weight: 800;
        white-space: nowrap;
      }
      .rank-value {
        font-weight: 600;
        overflow-wrap: anywhere;
        text-align: right;
      }
    </style>
    <script>
      const landing = document.querySelector('[data-testid="landing-screen"]');
      const waiting = document.querySelector('[data-testid="waiting-screen"]');
      const topic = document.querySelector('[data-testid="topic-screen"]');
      const dialog = document.querySelector('[data-testid="preview-dialog"]');
      const guess = document.querySelector('[data-testid="guess-screen"]');

      const show = (screen) => {
        [landing, waiting, topic, guess].forEach((node) => node?.classList.add('hidden'));
        if (screen) screen.classList.remove('hidden');
      };

      document.querySelector('[data-testid="play-now-btn"]')?.addEventListener('click', () => show(waiting));
      document.querySelector('[data-testid="start-game-btn"]')?.addEventListener('click', () => show(topic));
      document.querySelector('[data-testid="preview-btn"]')?.addEventListener('click', () => dialog?.classList.remove('hidden'));
      document.querySelector('[data-testid="start-selecting-btn"]')?.addEventListener('click', () => {
        dialog?.classList.add('hidden');
        show(guess);
      });
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
    };
  });
}

function overlaps(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe('Landscape mobile full-flow responsiveness', () => {
  for (const breakpoint of breakpoints) {
    test(`flow stays usable in landscape on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildLandscapeFlowMarkup(), { waitUntil: 'domcontentloaded' });

      const pageMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
        viewportHeight: window.innerHeight,
      }));
      expect(pageMetrics.scrollWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

      const playNow = page.getByTestId('play-now-btn');
      const landingTitle = page.getByTestId('landing-title');
      const landingCopy = page.getByTestId('landing-copy');
      await expect(playNow).toBeVisible();
      const landingTitleBox = await readBox(landingTitle);
      const landingCopyBox = await readBox(landingCopy);
      const playNowBox = await readBox(playNow);
      expect(overlaps(landingTitleBox, landingCopyBox)).toBeFalsy();
      expect(overlaps(landingCopyBox, playNowBox)).toBeFalsy();
      expect(playNowBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      await playNow.click();

      const playersHeading = page.getByTestId('players-heading');
      const addAi = page.getByTestId('add-ai-btn');
      const startGame = page.getByTestId('start-game-btn');
      await expect(startGame).toBeVisible();
      const playersHeadingBox = await readBox(playersHeading);
      const addAiBox = await readBox(addAi);
      const startGameBox = await readBox(startGame);
      expect(overlaps(playersHeadingBox, addAiBox)).toBeFalsy();
      expect(overlaps(addAiBox, startGameBox)).toBeFalsy();
      expect(startGameBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      await startGame.click();

      const topicHeading = page.getByTestId('topic-heading');
      const previewBtn = page.getByTestId('preview-btn');
      const firstTopicCard = page.getByTestId('topic-card').first();
      await expect(previewBtn).toBeVisible();
      const topicHeadingBox = await readBox(topicHeading);
      const topicCardBox = await readBox(firstTopicCard);
      const previewBtnBox = await readBox(previewBtn);
      expect(overlaps(topicHeadingBox, topicCardBox)).toBeFalsy();
      expect(overlaps(topicCardBox, previewBtnBox)).toBeFalsy();
      expect(previewBtnBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      await previewBtn.click();

      const dialog = page.getByTestId('preview-dialog');
      const dialogTitle = page.getByTestId('dialog-title');
      const startSelecting = page.getByTestId('start-selecting-btn');
      await expect(dialog).toBeVisible();
      const dialogTitleBox = await readBox(dialogTitle);
      const startSelectingBox = await readBox(startSelecting);
      expect(overlaps(dialogTitleBox, startSelectingBox)).toBeFalsy();
      expect(startSelectingBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight);
      await startSelecting.click();

      const guessHeading = page.getByTestId('guess-heading');
      const firstRank = page.getByTestId('rank-card').first();
      const lockIn = page.getByTestId('lock-in-btn');
      await expect(lockIn).toBeVisible();
      const guessHeadingBox = await readBox(guessHeading);
      const firstRankBox = await readBox(firstRank);
      const lockInBox = await readBox(lockIn);
      expect(overlaps(guessHeadingBox, firstRankBox)).toBeFalsy();
      expect(overlaps(firstRankBox, lockInBox)).toBeFalsy();
      expect(lockInBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight);
    });
  }
});
