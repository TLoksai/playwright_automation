import { expect, test } from '@playwright/test';

const tabletPortrait = { width: 768, height: 1024 };

function buildTabletPortraitFlowMarkup() {
  return `
    <main class="app-shell">
      <section class="screen landing-screen" data-testid="landing-screen">
        <div class="hero-copy">
          <p class="eyebrow">Landing</p>
          <h1 data-testid="landing-title">Play social ranking rounds with friends</h1>
          <p class="body-copy" data-testid="landing-copy">Create a room, preview topics, rank choices, and lock in your picks.</p>
        </div>
        <button class="primary-btn hero-cta" data-testid="play-now-btn" type="button">Play Now</button>
      </section>

      <section class="screen waiting-screen hidden" data-testid="waiting-screen">
        <div class="screen-header">
          <p class="eyebrow">Waiting for Players</p>
          <p class="room-code" data-testid="room-code">ROOM123PLAY</p>
          <h2 data-testid="players-heading">Players (2/6)</h2>
        </div>
        <div class="content-grid waiting-layout">
          <div class="card-stack">
            <div class="info-card" data-testid="player-card">Host Player</div>
            <div class="info-card" data-testid="player-card">AI Player</div>
          </div>
          <div class="action-stack">
            <button class="secondary-btn" data-testid="add-ai-btn" type="button">Add AI Player</button>
            <button class="primary-btn" data-testid="start-game-btn" type="button">Start Game</button>
          </div>
        </div>
      </section>

      <section class="screen topic-screen hidden" data-testid="topic-screen">
        <div class="screen-header">
          <p class="eyebrow">Topic Selection</p>
          <h2 data-testid="topic-heading">Round 1 - Topic Selection</h2>
        </div>
        <div class="content-grid topic-layout">
          <div class="card-grid" data-testid="topic-grid">
            <button class="topic-card" data-testid="topic-card" type="button">Bunnies</button>
            <button class="topic-card" data-testid="topic-card" type="button">Cats</button>
            <button class="topic-card" data-testid="topic-card" type="button">Hamsters</button>
            <button class="topic-card" data-testid="topic-card" type="button">Dogs</button>
          </div>
          <div class="side-panel">
            <button class="primary-btn" data-testid="preview-btn" type="button">Preview Topic</button>
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
              <button class="primary-btn" data-testid="start-selecting-btn" type="button">Start Selecting</button>
            </div>
          </div>
        </div>
      </div>

      <section class="screen guess-screen hidden" data-testid="guess-screen">
        <div class="screen-header">
          <p class="eyebrow">Guessing Phase</p>
          <h2 data-testid="guess-heading">Rank the VIP choices</h2>
        </div>
        <div class="content-grid guess-layout">
          <div class="rank-grid">
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">1st</span><span class="rank-value">Bunnies</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">2nd</span><span class="rank-value">Cats</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">3rd</span><span class="rank-value">Hamsters</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">4th</span><span class="rank-value">Dogs</span></div>
            <div class="rank-card" data-testid="rank-card"><span class="rank-label">5th</span><span class="rank-value">Birds</span></div>
          </div>
          <div class="side-panel">
            <button class="primary-btn" data-testid="lock-in-btn" type="button">Lock In</button>
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
        padding: 20px 20px 28px;
      }
      .screen {
        width: min(100%, 860px);
        background: #fff;
        border-radius: 24px;
        padding: 28px 24px;
        box-shadow: 0 16px 40px rgba(23, 32, 58, 0.12);
      }
      .hidden { display: none !important; }
      .eyebrow {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f6d94;
      }
      h1, h2, h3 {
        margin: 10px 0 0;
        line-height: 1.15;
      }
      h1 { font-size: 42px; }
      h2 { font-size: 30px; }
      h3 { font-size: 26px; }
      .body-copy {
        margin: 12px 0 0;
        font-size: 16px;
        line-height: 1.5;
        color: #50607d;
        max-width: 52ch;
      }
      .landing-screen {
        display: grid;
        gap: 28px;
      }
      .hero-copy,
      .screen-header,
      .action-stack,
      .card-stack,
      .side-panel,
      .rank-grid,
      .dialog-actions,
      .dialog-list {
        display: grid;
        gap: 12px;
      }
      .content-grid,
      .dialog-layout {
        margin-top: 22px;
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.9fr);
        gap: 20px;
        align-items: start;
      }
      .card-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .primary-btn,
      .secondary-btn {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 999px;
        font-weight: 700;
        padding: 12px 16px;
      }
      .primary-btn {
        background: #2b59ff;
        color: #fff;
      }
      .secondary-btn {
        background: #edf1ff;
        color: #25375e;
      }
      .hero-cta {
        max-width: 280px;
      }
      .room-code {
        margin: 8px 0 0;
        font-size: 34px;
        font-weight: 800;
        letter-spacing: 0.04em;
      }
      .info-card,
      .rank-card,
      .topic-card,
      .dialog-item {
        border: 1px solid #d8defb;
        border-radius: 16px;
        background: #f7f9ff;
      }
      .info-card {
        min-height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
        font-weight: 600;
      }
      .topic-card {
        min-height: 64px;
        padding: 14px;
        font-weight: 700;
      }
      .dialog-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(14, 20, 37, 0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .dialog-card {
        width: min(100%, 720px);
        max-height: min(80vh, 700px);
        overflow: auto;
        background: #fff;
        border-radius: 24px;
        padding: 24px;
        box-shadow: 0 20px 50px rgba(18, 26, 47, 0.2);
      }
      .dialog-item {
        min-height: 46px;
        display: flex;
        align-items: center;
        padding: 12px 14px;
        font-weight: 600;
      }
      .rank-card {
        min-height: 52px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
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
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
    };
  });
}

function overlaps(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe('Tablet portrait full-flow responsiveness', () => {
  test('layout adjusts cleanly with no broken alignment at tablet portrait', async ({ page }) => {
    await page.setViewportSize(tabletPortrait);
    await page.setContent(buildTabletPortraitFlowMarkup(), { waitUntil: 'domcontentloaded' });

    const pageMetrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0),
    }));

    expect(pageMetrics.scrollWidth).toBeLessThanOrEqual(pageMetrics.viewportWidth + 2);

    const landingScreen = page.getByTestId('landing-screen');
    const landingTitle = page.getByTestId('landing-title');
    const landingCopy = page.getByTestId('landing-copy');
    const playNow = page.getByTestId('play-now-btn');
    await expect(landingScreen).toBeVisible();
    await expect(playNow).toBeVisible();
    const landingScreenBox = await readBox(landingScreen);
    const landingTitleBox = await readBox(landingTitle);
    const landingCopyBox = await readBox(landingCopy);
    const playNowBox = await readBox(playNow);
    expect(overlaps(landingTitleBox, landingCopyBox)).toBeFalsy();
    expect(overlaps(landingCopyBox, playNowBox)).toBeFalsy();
    expect(Math.abs(landingTitleBox.centerX - landingScreenBox.centerX)).toBeLessThanOrEqual(120);
    expect(playNowBox.left).toBeGreaterThanOrEqual(landingScreenBox.left + 16);
    expect(playNowBox.right).toBeLessThanOrEqual(landingScreenBox.right - 16);
    await playNow.click();

    const waitingScreen = page.getByTestId('waiting-screen');
    const playersHeading = page.getByTestId('players-heading');
    const playerCards = page.getByTestId('player-card');
    const addAi = page.getByTestId('add-ai-btn');
    const startGame = page.getByTestId('start-game-btn');
    await expect(waitingScreen).toBeVisible();
    await expect(playerCards).toHaveCount(2);
    const playersHeadingBox = await readBox(playersHeading);
    const firstPlayerCardBox = await readBox(playerCards.first());
    const addAiBox = await readBox(addAi);
    const startGameBox = await readBox(startGame);
    expect(overlaps(playersHeadingBox, firstPlayerCardBox)).toBeFalsy();
    expect(overlaps(addAiBox, startGameBox)).toBeFalsy();
    expect(addAiBox.left).toBeGreaterThan(firstPlayerCardBox.right - 8);
    expect(startGameBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight - 16);
    await startGame.click();

    const topicScreen = page.getByTestId('topic-screen');
    const topicHeading = page.getByTestId('topic-heading');
    const topicCards = page.getByTestId('topic-card');
    const previewBtn = page.getByTestId('preview-btn');
    await expect(topicScreen).toBeVisible();
    await expect(topicCards).toHaveCount(4);
    const topicHeadingBox = await readBox(topicHeading);
    const firstTopicBox = await readBox(topicCards.first());
    const secondTopicBox = await readBox(topicCards.nth(1));
    const previewBtnBox = await readBox(previewBtn);
    expect(overlaps(topicHeadingBox, firstTopicBox)).toBeFalsy();
    expect(overlaps(firstTopicBox, previewBtnBox)).toBeFalsy();
    expect(Math.abs(firstTopicBox.top - secondTopicBox.top)).toBeLessThanOrEqual(4);
    expect(previewBtnBox.left).toBeGreaterThan(firstTopicBox.right - 8);
    await previewBtn.click();

    const dialog = page.getByTestId('preview-dialog');
    const dialogTitle = page.getByTestId('dialog-title');
    const dialogButton = page.getByTestId('start-selecting-btn');
    await expect(dialog).toBeVisible();
    const dialogTitleBox = await readBox(dialogTitle);
    const dialogButtonBox = await readBox(dialogButton);
    expect(overlaps(dialogTitleBox, dialogButtonBox)).toBeFalsy();
    expect(dialogButtonBox.right).toBeLessThanOrEqual(pageMetrics.viewportWidth - 24);
    expect(dialogButtonBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight - 24);
    await dialogButton.click();

    const guessScreen = page.getByTestId('guess-screen');
    const guessHeading = page.getByTestId('guess-heading');
    const rankCards = page.getByTestId('rank-card');
    const lockIn = page.getByTestId('lock-in-btn');
    await expect(guessScreen).toBeVisible();
    await expect(rankCards).toHaveCount(5);
    const guessHeadingBox = await readBox(guessHeading);
    const firstRankBox = await readBox(rankCards.first());
    const secondRankBox = await readBox(rankCards.nth(1));
    const lockInBox = await readBox(lockIn);
    expect(overlaps(guessHeadingBox, firstRankBox)).toBeFalsy();
    expect(overlaps(firstRankBox, lockInBox)).toBeFalsy();
    expect(firstRankBox.right).toBeLessThan(lockInBox.left + 12);
    expect(secondRankBox.top).toBeGreaterThan(firstRankBox.bottom - 2);
    expect(lockInBox.bottom).toBeLessThanOrEqual(pageMetrics.viewportHeight - 16);
  });
});
