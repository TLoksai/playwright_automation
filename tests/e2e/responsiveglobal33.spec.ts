import { expect, test } from '@playwright/test';

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 } },
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
];

function buildCompleteFlowMarkup() {
  return `
    <main class="app-shell" data-phase="landing">
      <section class="screen landing-screen" data-testid="landing-screen">
        <p class="eyebrow">Landing</p>
        <h1 data-testid="landing-title">Play social ranking rounds with friends</h1>
        <p class="body-copy" data-testid="landing-copy">Create a room, preview topics, rank choices, and lock in your picks.</p>
        <button class="primary-btn" data-testid="play-now-btn" type="button">Play Now</button>
      </section>

      <section class="screen waiting-screen hidden" data-testid="waiting-screen">
        <p class="eyebrow">Waiting for Players</p>
        <p class="room-code" data-testid="room-code">ROOM123PLAY</p>
        <h2 data-testid="players-heading">Players (2/6)</h2>
        <div class="card-stack">
          <div class="info-card" data-testid="player-card">Host Player</div>
          <div class="info-card" data-testid="player-card">AI Player</div>
        </div>
        <div class="action-stack">
          <button class="secondary-btn" data-testid="add-ai-btn" type="button">Add AI Player</button>
          <button class="primary-btn" data-testid="start-game-btn" type="button">Start Game</button>
        </div>
      </section>

      <section class="screen topic-screen hidden" data-testid="topic-screen">
        <p class="eyebrow">Topic Selection</p>
        <h2 data-testid="topic-heading">Round 1 - Topic Selection</h2>
        <div class="card-grid" data-testid="topic-grid">
          <button class="topic-card" data-testid="topic-card" type="button">Bunnies</button>
          <button class="topic-card" data-testid="topic-card" type="button">Cats</button>
          <button class="topic-card" data-testid="topic-card" type="button">Hamsters</button>
          <button class="topic-card" data-testid="topic-card" type="button">Dogs</button>
        </div>
        <button class="primary-btn" data-testid="preview-btn" type="button">Preview Topic</button>
      </section>

      <div class="dialog-backdrop hidden" data-testid="preview-dialog">
        <div class="dialog-card" role="dialog" aria-modal="true">
          <h3 data-testid="dialog-title">VIP Topic Preview</h3>
          <div class="dialog-list">
            <div class="dialog-item">1. Bunnies</div>
            <div class="dialog-item">2. Cats</div>
            <div class="dialog-item">3. Hamsters</div>
            <div class="dialog-item">4. Dogs</div>
            <div class="dialog-item">5. Birds</div>
          </div>
          <button class="primary-btn" data-testid="start-selecting-btn" type="button">Start Selecting</button>
        </div>
      </div>

      <section class="screen guess-screen hidden" data-testid="guess-screen">
        <p class="eyebrow">Guessing Phase</p>
        <h2 data-testid="guess-heading">Rank the VIP choices</h2>
        <div class="rank-grid">
          <div class="rank-card" data-testid="rank-card"><span class="rank-label">1st</span><span class="rank-value">Bunnies</span></div>
          <div class="rank-card" data-testid="rank-card"><span class="rank-label">2nd</span><span class="rank-value">Cats</span></div>
          <div class="rank-card" data-testid="rank-card"><span class="rank-label">3rd</span><span class="rank-value">Hamsters</span></div>
          <div class="rank-card" data-testid="rank-card"><span class="rank-label">4th</span><span class="rank-value">Dogs</span></div>
          <div class="rank-card" data-testid="rank-card"><span class="rank-label">5th</span><span class="rank-value">Birds</span></div>
        </div>
        <button class="primary-btn" data-testid="lock-in-btn" type="button">Lock In</button>
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
        padding: 16px 12px 24px;
      }
      .screen {
        width: min(100%, 760px);
        background: #fff;
        border-radius: 20px;
        padding: 18px 16px;
        box-shadow: 0 16px 40px rgba(23, 32, 58, 0.12);
      }
      .hidden { display: none !important; }
      .eyebrow {
        margin: 0;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6d94;
      }
      h1, h2, h3 {
        margin: 8px 0 0;
        line-height: 1.15;
      }
      h1 { font-size: clamp(24px, 4vw, 40px); }
      h2 { font-size: clamp(22px, 3.5vw, 32px); }
      h3 { font-size: clamp(20px, 3vw, 28px); }
      .body-copy {
        margin: 10px 0 0;
        font-size: 15px;
        line-height: 1.45;
        color: #50607d;
      }
      .primary-btn, .secondary-btn {
        width: 100%;
        min-height: 44px;
        border: 0;
        border-radius: 999px;
        font-weight: 700;
        padding: 12px 16px;
      }
      .primary-btn {
        margin-top: 16px;
        background: #2b59ff;
        color: #fff;
      }
      .secondary-btn {
        background: #edf1ff;
        color: #25375e;
      }
      .room-code {
        margin: 12px 0 0;
        font-size: clamp(22px, 5vw, 34px);
        font-weight: 800;
        text-align: center;
      }
      .card-stack, .action-stack {
        margin-top: 16px;
        display: grid;
        gap: 10px;
      }
      .info-card, .rank-card, .topic-card, .dialog-item {
        border: 1px solid #d8defb;
        border-radius: 16px;
        background: #f7f9ff;
      }
      .info-card {
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 12px;
        font-weight: 600;
      }
      .card-grid {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .topic-card {
        min-height: 54px;
        padding: 12px;
        font-weight: 700;
      }
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(14, 20, 37, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .dialog-card {
        width: min(100%, 520px);
        max-height: min(80vh, 560px);
        overflow: auto;
        background: #fff;
        border-radius: 20px;
        padding: 18px 16px;
        box-shadow: 0 20px 50px rgba(18, 26, 47, 0.2);
      }
      .dialog-list {
        margin-top: 14px;
        display: grid;
        gap: 8px;
      }
      .dialog-item {
        min-height: 42px;
        display: flex;
        align-items: center;
        padding: 10px 12px;
        font-weight: 600;
      }
      .rank-grid {
        margin-top: 16px;
        display: grid;
        gap: 8px;
      }
      .rank-card {
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
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
      @media (min-width: 900px) {
        .card-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
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

async function readBox(locator: Locator) {
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

test.describe('Complete flow overlap safety', () => {
  for (const breakpoint of breakpoints) {
    test(`buttons, text, cards, and dialogs do not overlap on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await page.setContent(buildCompleteFlowMarkup(), { waitUntil: 'domcontentloaded' });

      const pageMetrics = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
      }));

      expect(pageMetrics.scrollWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

      const landingTitle = page.getByTestId('landing-title');
      const landingCopy = page.getByTestId('landing-copy');
      const playNow = page.getByTestId('play-now-btn');
      await expect(landingTitle).toBeVisible();
      await expect(playNow).toBeVisible();
      const landingTitleBox = await readBox(landingTitle);
      const landingCopyBox = await readBox(landingCopy);
      const playNowBox = await readBox(playNow);
      expect(overlaps(landingTitleBox, landingCopyBox)).toBeFalsy();
      expect(overlaps(landingCopyBox, playNowBox)).toBeFalsy();
      await playNow.click();

      const playersHeading = page.getByTestId('players-heading');
      const playerCards = page.getByTestId('player-card');
      const addAi = page.getByTestId('add-ai-btn');
      const startGame = page.getByTestId('start-game-btn');
      await expect(playersHeading).toBeVisible();
      await expect(addAi).toBeVisible();
      await expect(startGame).toBeVisible();
      const playersHeadingBox = await readBox(playersHeading);
      const addAiBox = await readBox(addAi);
      const startGameBox = await readBox(startGame);
      expect(overlaps(playersHeadingBox, addAiBox)).toBeFalsy();
      expect(overlaps(addAiBox, startGameBox)).toBeFalsy();
      expect(await playerCards.count()).toBeGreaterThan(1);
      await startGame.click();

      const topicHeading = page.getByTestId('topic-heading');
      const topicCards = page.getByTestId('topic-card');
      const previewBtn = page.getByTestId('preview-btn');
      await expect(topicHeading).toBeVisible();
      await expect(topicCards).toHaveCount(4);
      await expect(previewBtn).toBeVisible();
      const topicHeadingBox = await readBox(topicHeading);
      const firstTopicCardBox = await readBox(topicCards.first());
      const previewBtnBox = await readBox(previewBtn);
      expect(overlaps(topicHeadingBox, firstTopicCardBox)).toBeFalsy();
      expect(overlaps(firstTopicCardBox, previewBtnBox)).toBeFalsy();
      await previewBtn.click();

      const dialog = page.getByTestId('preview-dialog');
      const dialogTitle = page.getByTestId('dialog-title');
      const dialogButton = page.getByTestId('start-selecting-btn');
      await expect(dialog).toBeVisible();
      await expect(dialogTitle).toBeVisible();
      await expect(dialogButton).toBeVisible();
      const dialogTitleBox = await readBox(dialogTitle);
      const dialogButtonBox = await readBox(dialogButton);
      expect(overlaps(dialogTitleBox, dialogButtonBox)).toBeFalsy();
      await dialogButton.click();

      const guessHeading = page.getByTestId('guess-heading');
      const rankCards = page.getByTestId('rank-card');
      const lockIn = page.getByTestId('lock-in-btn');
      await expect(guessHeading).toBeVisible();
      await expect(rankCards).toHaveCount(5);
      await expect(lockIn).toBeVisible();
      const guessHeadingBox = await readBox(guessHeading);
      const firstRankBox = await readBox(rankCards.first());
      const lockInBox = await readBox(lockIn);
      expect(overlaps(guessHeadingBox, firstRankBox)).toBeFalsy();
      expect(overlaps(firstRankBox, lockInBox)).toBeFalsy();
    });
  }
});
