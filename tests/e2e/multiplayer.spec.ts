import { test, expect, type Locator, type Page } from '@playwright/test';

async function openPlayScreen(page: Page, playerName: string) {
  await page.goto('https://knowsy.game/');
  
  // Try Play Now link first (desktop), then Start Playing button (mobile/tablet)
  const playNowLink = page.getByRole('link', { name: 'Play Now' });
  const startPlayingBtn = page.getByRole('button', { name: 'Start Playing' }).first();
  
  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else if (await startPlayingBtn.isVisible().catch(() => false)) {
    await startPlayingBtn.click();
  } else {
    throw new Error('Could not find Play Now link or Start Playing button');
  }
  
  await page.getByRole('textbox', { name: 'Enter your name' }).first().fill(playerName);
}

async function joinRoom(page: Page, playerName: string, roomCode: string) {
  await page.goto('https://knowsy.game/');
  
  // Try Play Now link first (desktop), then Start Playing button (mobile/tablet)
  const playNowLink = page.getByRole('link', { name: 'Play Now' });
  const startPlayingBtn = page.getByRole('button', { name: 'Start Playing' }).first();
  
  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else if (await startPlayingBtn.isVisible().catch(() => false)) {
    await startPlayingBtn.click();
  } else {
    throw new Error('Could not find Play Now link or Start Playing button');
  }
  
  await page.getByRole('textbox', { name: 'Enter your name' }).nth(1).fill(playerName);
  await page.getByRole('textbox', { name: 'e.g., Success5Win3' }).fill(roomCode);
  await page.getByRole('button', { name: 'Join Game Room' }).click();
}

async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

async function pageHasVipNotice(page: Page): Promise<boolean> {
  const main = page.getByRole('main');
  if ((await main.count()) === 0) return false;

  try {
    const text = (await main.innerText()) ?? '';
    return /you are the vip/i.test(text);
  } catch {
    return false;
  }
}

function getOppositePage(candidate: Page, hostPage: Page, joinerPage: Page): Page {
  return candidate === hostPage ? joinerPage : hostPage;
}

async function ensureGuessingPlayerPage(candidate: Page, hostPage: Page, joinerPage: Page): Promise<Page> {
  if (!(await pageHasVipNotice(candidate))) return candidate;

  const alternate = getOppositePage(candidate, hostPage, joinerPage);
  if (await pageHasVipNotice(alternate)) {
    throw new Error('Both pages show VIP notices; no eligible guessing page found.');
  }

  return alternate;
}

async function reorderBunniesAndCats(page: Page, orderedItems: Locator) {
  const bunniesCard = orderedItems.filter({ hasText: 'Bunnies' });
  const catsCard = orderedItems.filter({ hasText: 'Cats' });
  
  // Wait for elements to actually have the sortable aria-roledescription attribute
  try {
    await orderedItems.first().waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForFunction(
      () => {
        const items = document.querySelectorAll('[role="button"][aria-roledescription="sortable"]');
        return items.length > 0;
      },
      { timeout: 10000 }
    );
  } catch {
    // Elements don't have sortable attribute yet - not in reorder mode
    return;
  }
  
  const bunniesCount = await bunniesCard.count();
  const catsCount = await catsCard.count();
  
  if (bunniesCount === 0 || catsCount === 0) return;

  // Ensure first element is visible before getting bounding box
  const firstItem = orderedItems.first();
  if (!(await firstItem.isVisible())) return;

  const bunniesCardBox = await bunniesCard.first().boundingBox();
  const catsCardBox = await catsCard.first().boundingBox();
  if (!bunniesCardBox || !catsCardBox) return;

  await page.mouse.move(
    bunniesCardBox.x + bunniesCardBox.width / 2,
    bunniesCardBox.y + bunniesCardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    catsCardBox.x + catsCardBox.width / 2,
    catsCardBox.y + catsCardBox.height / 2,
    { steps: 25 }
  );
  await page.mouse.up();

  // Fallback when mouse drag is ignored by DnD state.
  if ((await orderedItems.count()) === 0 || !(await orderedItems.first().isVisible())) return;
  let firstItemTextAfterMouseDrag = '';
  try {
    firstItemTextAfterMouseDrag = (await orderedItems.nth(0).textContent({ timeout: 1000 }))?.trim() ?? '';
  } catch {
    return;
  }
  if (!firstItemTextAfterMouseDrag.includes('Cats')) {
    await bunniesCard.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
  }
}

async function trySubmitSelectionIfReady(page: Page): Promise<boolean> {
  const submitSelection = page.getByRole('button', { name: /submit selection/i }).first();
  const submitGuess = page.getByRole('button', { name: /submit guess/i }).first();
  if (await isVisible(submitGuess)) return false;

  const topicButton = page.getByRole('button', { name: 'Most Adorable Pet' }).first();
  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  const hasOrderedItems = (await orderedItems.count()) > 0 && (await orderedItems.first().isVisible());

  // If this page is still in topic pick mode, choose topic and 5 cards.
  if (!hasOrderedItems && (await isVisible(topicButton))) {
    await topicButton.click();
    // Wait for the items list to load after clicking topic
    await page.waitForTimeout(500);
    for (const option of ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds']) {
      const optionButton = page.getByRole('button', { name: option }).first();
      if (await isVisible(optionButton)) {
        await optionButton.click();
        await page.waitForTimeout(300); // Small delay between selections
      }
    }
    // Wait for submit button to appear after selecting items
    await page.waitForTimeout(1000);
  }

  // If cards are sortable now, apply a reorder before submit.
  // Wait for the sortable attribute to be present
  let isSortable = false;
  try {
    await page.waitForFunction(
      () => document.querySelector('[role="button"][aria-roledescription="sortable"]') !== null,
      { timeout: 5000 }
    );
    isSortable = true;
  } catch {
    isSortable = false;
  }
  
  if (isSortable && (await orderedItems.count()) > 0 && (await orderedItems.first().isVisible())) {
    await reorderBunniesAndCats(page, orderedItems);
  }

  if ((await submitSelection.count()) > 0 && (await submitSelection.isVisible()) && (await submitSelection.isEnabled())) {
    await submitSelection.click();
    return true;
  }

  return false;
}

async function waitForSelectionSubmission(pages: Page | Page[], maxWaitMs = 150000): Promise<Page> {
  const candidatePages = Array.isArray(pages) ? pages : [pages];
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const page of candidatePages) {
      if (await trySubmitSelectionIfReady(page)) return page;
    }
    await candidatePages[0].waitForTimeout(1000);
  }

  throw new Error('No page reached a submit-selection state in time.');
}

async function clickContinueWhenReady(pages: Page | Page[], maxWaitMs = 150000): Promise<Page> {
  const candidatePages = Array.isArray(pages) ? pages : [pages];
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    for (const page of candidatePages) {
      const candidateButtons = [
        page.getByRole('button', { name: /next vip!?/i }).first(),
        page.getByRole('button', { name: /continue.*round/i }).first(),
        page.getByRole('button', { name: /next round/i }).first(),
        page.getByRole('button', { name: /continue/i }).first(),
        page.getByRole('button', { name: /start next/i }).first(),
      ];

      for (const button of candidateButtons) {
        if ((await button.count()) > 0 && (await button.isVisible()) && (await button.isEnabled())) {
          await button.click();
          return page;
        }
      }
    }
    await candidatePages[0].waitForTimeout(1000);
  }

  throw new Error('Next VIP!/Continue button did not appear in time.');
}

async function rearrangeHostGuessAndSubmit(page: Page) {
  await expect(page.getByRole('main')).toContainText(/current vip/i, { timeout: 120000 });
  await expect(page.getByRole('main')).toContainText(/submit guess/i, { timeout: 120000 });

  const orderedItems = page.locator('[role="button"][aria-roledescription="sortable"]');
  await expect(orderedItems.first()).toBeVisible({ timeout: 120000 });
  const beforeOrder = await orderedItems.allTextContents();

  const bunniesCard = orderedItems.filter({ hasText: 'Bunnies' });
  const catsCard = orderedItems.filter({ hasText: 'Cats' });
  
  // Ensure elements are visible before getting bounding box
  if (!(await bunniesCard.first().isVisible()) || !(await catsCard.first().isVisible())) {
    throw new Error('Could not find host guess card positions - elements not visible.');
  }
  
  const bunniesCardBox = await bunniesCard.first().boundingBox();
  const catsCardBox = await catsCard.first().boundingBox();
  if (!bunniesCardBox || !catsCardBox) {
    throw new Error('Could not find host guess card positions for drag-and-drop.');
  }

  await page.mouse.move(
    bunniesCardBox.x + bunniesCardBox.width / 2,
    bunniesCardBox.y + bunniesCardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    catsCardBox.x + catsCardBox.width / 2,
    catsCardBox.y + catsCardBox.height / 2,
    { steps: 25 }
  );
  await page.mouse.up();

  const afterMouseDragOrder = await orderedItems.allTextContents();
  if (afterMouseDragOrder.join('||') === beforeOrder.join('||')) {
    // Fallback when mouse drag is ignored by DnD state.
    await orderedItems.first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
  }

  await page.getByRole('button', { name: /submit guess/i }).click();
}

async function waitForGuessingPage(hostPage: Page, joinerPage: Page, maxWaitMs = 120000): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const hostGuessButton = hostPage.getByRole('button', { name: /submit guess/i }).first();
    if (
      (await hostGuessButton.count()) > 0 &&
      (await hostGuessButton.isVisible()) &&
      !(await pageHasVipNotice(hostPage))
    ) {
      const hostOrderedItems = hostPage.locator('[role="button"][aria-roledescription="sortable"]');
      if ((await hostOrderedItems.count()) > 0 && (await hostOrderedItems.first().isVisible())) {
        return hostPage;
      }
    }

    const joinerGuessButton = joinerPage.getByRole('button', { name: /submit guess/i }).first();
    if (
      (await joinerGuessButton.count()) > 0 &&
      (await joinerGuessButton.isVisible()) &&
      !(await pageHasVipNotice(joinerPage))
    ) {
      const joinerOrderedItems = joinerPage.locator('[role="button"][aria-roledescription="sortable"]');
      if ((await joinerOrderedItems.count()) > 0 && (await joinerOrderedItems.first().isVisible())) {
        return joinerPage;
      }
    }

    await hostPage.waitForTimeout(1000);
  }

  throw new Error('No guessing page appeared (Submit Guess button not found).');
}

async function expectPostGuessProgress(page: Page) {
  const main = page.getByRole('main');
  try {
    await expect(main).toContainText(
      /1 of 1 active players have guessed|guess submitted|round results|actual order|continue|ready to play|waiting for host to continue/i,
      { timeout: 30000 }
    );
  } catch (error) {
    const text = (await main.innerText().catch(() => '')) ?? '';
    const vipWaitingPattern = /you are the vip/i.test(text) && /waiting for .*player/i.test(text);
    if (!vipWaitingPattern) throw error;
  }
}

test('multiplayer flow continues after dynamic room join', async ({ page, browser }) => {
  test.setTimeout(300000);

  await openPlayScreen(page, 'Host User');
  await page.getByRole('button', { name: 'Create Game Room' }).click();

  // Room code is dynamic (e.g. Thunder5Blast9), so capture it by pattern.
  const roomCodeLocator = page.locator('main').getByText(/^[A-Za-z]+\d+[A-Za-z]+\d+$/).first();
  await expect(roomCodeLocator).toBeVisible();
  const roomCode = (await roomCodeLocator.textContent())?.trim();
  if (!roomCode) {
    throw new Error('Room code was not found after creating the room.');
  }

  // Open a second page as another player and join using the captured code.
  const joinerContext = await browser.newContext();
  const joinerPage = await joinerContext.newPage();
  await joinRoom(joinerPage, 'Joiner User', roomCode);

  await expect(joinerPage.getByRole('heading', { name: 'Waiting for Players' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Players \(2\/6\)/ })).toBeVisible();

  // Continue multiplayer flow: host starts game, both players reach topic selection.
  await expect(page.getByRole('button', { name: 'Start Game' })).toBeEnabled();
  await page.getByRole('button', { name: 'Start Game' }).click();

  await expect(page.getByRole('heading', { name: 'Round 1 - Topic Selection' })).toBeVisible();
  await expect(joinerPage.getByRole('heading', { name: 'Round 1 - Topic Selection' })).toBeVisible();

  // Topic/card selection can appear on either side; submit both players dynamically.
  await waitForSelectionSubmission([page, joinerPage]);
  await waitForSelectionSubmission([page, joinerPage]);

  await expect(page.getByRole('main')).toContainText(/submitted|selection complete|2 of 2 players ready/i);
  await clickContinueWhenReady([page, joinerPage]);  // one of the two pages may own the continue button

  const guessingPage = await waitForGuessingPage(page, joinerPage);
  const activeGuessingPage = await ensureGuessingPlayerPage(guessingPage, page, joinerPage);
  await rearrangeHostGuessAndSubmit(activeGuessingPage);

  await expectPostGuessProgress(page);
  await expectPostGuessProgress(joinerPage);
  await clickContinueWhenReady([page, joinerPage], 1200);

  await waitForSelectionSubmission([page, joinerPage]);
  await waitForSelectionSubmission([page, joinerPage]);

  await expect(page.getByRole('main')).toContainText(/submitted|selection complete|2 of 2 players ready/i);
  await clickContinueWhenReady([page, joinerPage]);

  const secondRoundGuessingPage = await waitForGuessingPage(page, joinerPage);
  const activeSecondGuessingPage = await ensureGuessingPlayerPage(secondRoundGuessingPage, page, joinerPage);
  await rearrangeHostGuessAndSubmit(activeSecondGuessingPage);

  await expectPostGuessProgress(page);
  await expectPostGuessProgress(joinerPage);
  await clickContinueWhenReady([page, joinerPage], 1200);

  await joinerContext.close();
});
