import { expect, test, type Page, type Route } from '@playwright/test';

type JoinScenario = 'success' | 'invalid' | 'full';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
};

async function setupSupabaseMocks(page: Page, scenario: JoinScenario, roomCode = 'ROOM123PLAY') {
  await page.route('https://knowsy-game.supabase.co/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }

    if (url.pathname.endsWith('/rpc/validate_join_code')) {
      const body =
        scenario === 'invalid'
          ? { room_exists: false }
          : {
              room_exists: true,
              organization_id: null,
              user_already_joined: false,
              room_status: scenario === 'full' ? 'waiting' : 'waiting',
              player_count: scenario === 'full' ? 6 : 3,
              room_id: 12345,
              join_code: roomCode,
            };

      return route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
    }

    if (url.pathname.includes('/rest/v1/players')) {
      if (method === 'POST') {
        return route.fulfill({
          status: 201,
          headers: JSON_HEADERS,
          body: JSON.stringify([{ id: 987 }]),
        });
      }

      return route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: '[]',
      });
    }

    return route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: '{}',
    });
  });
}

async function fillJoinForm(page: Page, playerName: string, roomCode: string) {
  const nameInputs = page.getByPlaceholder('Enter your name');
  const joinNameInput = (await nameInputs.count()) > 1 ? nameInputs.nth(1) : nameInputs.first();
  await expect(joinNameInput).toBeVisible({ timeout: 90_000 });
  await joinNameInput.fill(playerName);

  await page.getByPlaceholder('e.g., Success5Win3').fill(roomCode);
  await page.getByRole('button', { name: 'Join Game Room' }).click();
}

test.describe('Player joins an existing room', () => {
  test('joins when a valid room code is provided', async ({ page }) => {
    const expectedRoomCode = 'FUN123PLAY';
    await setupSupabaseMocks(page, 'success', expectedRoomCode);

    await page.goto('/play');
    await fillJoinForm(page, 'Playwright Player', expectedRoomCode);

    await expect(page).toHaveURL(new RegExp(`/game/${expectedRoomCode}`));
  });

  test('shows an error when the room code is invalid', async ({ page }) => {
    await setupSupabaseMocks(page, 'invalid');

    await page.goto('/play');
    await fillJoinForm(page, 'Invalid Tester', 'INVALID01');

    await expect(page.getByText('Room not found')).toBeVisible();
    await expect(page).toHaveURL(/\/play/);
  });

  test('shows an error when the room is already full', async ({ page }) => {
    await setupSupabaseMocks(page, 'full');

    await page.goto('/play');
    await fillJoinForm(page, 'Full Room Tester', 'FULL9999');

    await expect(page.getByText('Room is full')).toBeVisible();
    await expect(page).toHaveURL(/\/play/);
  });
});
