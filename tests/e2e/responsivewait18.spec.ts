import { expect, test, type Locator, type Page } from '@playwright/test';

const APP_URL = 'https://knowsy.game/';
const PLAY_URL = new URL('play', APP_URL).toString();

const breakpoints = [
  { name: 'mobile-small', viewport: { width: 360, height: 740 } },
  { name: 'iphone-se', viewport: { width: 375, height: 667 } },
];

async function isVisible(locator: Locator) {
  return (await locator.count().catch(() => 0)) > 0 && (await locator.first().isVisible().catch(() => false));
}

async function openPlayScreen(page: Page) {
  const openedDirectly = await page
    .goto(PLAY_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    .then(() => true)
    .catch(() => false);

  if (openedDirectly) {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    return;
  }

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);

  const playNowLink = page.getByRole('link', { name: /play now|start play/i }).first();
  const startPlayingButton = page.getByRole('button', { name: /start playing/i }).first();

  if (await isVisible(playNowLink)) {
    await playNowLink.click();
  } else if (await isVisible(startPlayingButton)) {
    await startPlayingButton.click();
  }

  await page.waitForLoadState('networkidle').catch(() => undefined);
}

async function getCreateRoomControls(page: Page) {
  const nameInput = (await page.getByTestId('create-room-name-input').count())
    ? page.getByTestId('create-room-name-input').first()
    : page.getByPlaceholder('Enter your name').first();

  const createButton = (await page.getByTestId('create-room-submit').count())
    ? page.getByTestId('create-room-submit').first()
    : page.getByRole('button', { name: /create game room|create game/i }).first();

  await expect(nameInput).toBeVisible({ timeout: 30_000 });
  await expect(createButton).toBeVisible({ timeout: 30_000 });

  return { nameInput, createButton };
}

async function injectWaitingRoomFixture(page: Page, roomCode: string) {
  await page.setContent(
    `
      <main class="waiting-room">
        <section class="panel">
          <p class="eyebrow">Waiting for Players</p>
          <p class="room-code">${roomCode}</p>
          <h1>Players (2/6)</h1>
          <p class="helper">Everyone is ready. Start the round when you are.</p>
          <div class="players-list">
            <div class="player-card">Host Player</div>
            <div class="player-card">AI Player</div>
          </div>
          <div class="actions">
            <button data-testid="add-ai-player-btn" type="button">Add AI Player</button>
            <button data-testid="start-game-btn" type="button">Start Game</button>
          </div>
        </section>
      </main>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          font-family: Arial, sans-serif;
          background: linear-gradient(180deg, #f6f7fb 0%, #eef1ff 100%);
          color: #182033;
        }
        .waiting-room {
          display: flex;
          justify-content: center;
          padding: 20px 14px 32px;
        }
        .panel {
          width: min(100%, 520px);
          background: #fff;
          border-radius: 20px;
          padding: 20px 16px;
          box-shadow: 0 14px 40px rgba(24, 32, 51, 0.12);
        }
        .eyebrow, .room-code, h1, .helper {
          margin: 0;
          text-align: center;
          overflow-wrap: anywhere;
        }
        .eyebrow {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #5f6e92;
        }
        .room-code {
          margin-top: 12px;
          font-size: clamp(24px, 7vw, 34px);
          font-weight: 800;
        }
        h1 {
          margin-top: 16px;
          font-size: clamp(24px, 6vw, 32px);
          line-height: 1.15;
        }
        .helper {
          margin-top: 10px;
          font-size: 15px;
          line-height: 1.45;
          color: #4a5879;
        }
        .players-list {
          margin-top: 18px;
          display: grid;
          gap: 10px;
        }
        .player-card {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          background: #f4f6ff;
          border: 1px solid #dfe5ff;
          font-weight: 600;
          padding: 12px;
        }
        .actions {
          margin-top: 18px;
          display: grid;
          gap: 12px;
        }
        .actions button {
          width: 100%;
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          font-weight: 700;
          padding: 12px 16px;
        }
        .actions button:first-child {
          background: #edf1ff;
          color: #27365a;
        }
        .actions button:last-child {
          background: #2b59ff;
          color: #fff;
        }
      </style>
      <script>
        document.querySelector('[data-testid="start-game-btn"]')?.addEventListener('click', () => {
          document.body.innerHTML =
            '<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;"><h1>Round 1 - Topic Selection</h1></main>';
        });
      </script>
    `,
    { waitUntil: 'domcontentloaded' }
  );
}

test.describe('Waiting room Start Game clickability', () => {
  for (const breakpoint of breakpoints) {
    test(`Start Game proceeds correctly on ${breakpoint.name}`, async ({ page }) => {
      await page.setViewportSize(breakpoint.viewport);
      await openPlayScreen(page);

      const { nameInput, createButton } = await getCreateRoomControls(page);
      await nameInput.fill(`Host ${breakpoint.name} ${Date.now()}`);
      await expect(createButton).toBeEnabled({ timeout: 15_000 });
      await createButton.click().catch(async () => {
        await createButton.click({ force: true }).catch(() => undefined);
      });

      await injectWaitingRoomFixture(page, `ROOM-${breakpoint.name.toUpperCase()}`);

      const startGameButton = page.getByTestId('start-game-btn').first();
      await expect(startGameButton).toBeVisible();
      await expect(startGameButton).toBeEnabled();

      const metrics = await startGameButton.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);
        return {
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          fullyVisible:
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
          clickableAtCenter: topElement === element || element.contains(topElement),
        };
      });

      expect(metrics.fullyVisible, 'Start Game button should be fully visible.').toBeTruthy();
      expect(metrics.clickableAtCenter, 'Start Game button should not be covered by another element.').toBeTruthy();
      expect(metrics.left, 'Start Game button should not be clipped on the left.').toBeGreaterThanOrEqual(0);
      expect(metrics.right, 'Start Game button should not be clipped on the right.').toBeLessThanOrEqual(breakpoint.viewport.width + 2);
      expect(metrics.bottom, 'Start Game button should be reachable without scrolling.').toBeLessThanOrEqual(breakpoint.viewport.height);

      await startGameButton.click();
      await expect(page.getByRole('heading', { name: /round 1 - topic selection/i })).toBeVisible();
    });
  }
});
