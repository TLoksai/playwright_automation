const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://knowsy.game/');
  const signInLink = page.getByRole('link', { name: /sign in/i }).first();
  if ((await signInLink.count()) > 0) {
    await signInLink.click();
  }
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('textbox', { name: /email/i }).first().fill('richelle2305@gmail.com');
  await page.getByRole('textbox', { name: /password/i }).first().fill('Richelle23#');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.goto('https://knowsy.game/play', { waitUntil: 'domcontentloaded' });
  const nameInput = page.locator('[data-testid="create-room-name-input"], input[placeholder="Enter your name"]').first();
  await nameInput.waitFor({ state: 'visible', timeout: 60000 });
  await nameInput.fill('Inspector Host');
  await page.getByRole('button', { name: /create game room/i }).first().click();
  await page.waitForTimeout(5000);
  const roomCodeCandidate = page.locator('[data-testid="room-code"]');
  if ((await roomCodeCandidate.count()) > 0) {
    console.log('room-code testid:', await roomCodeCandidate.first().innerText());
  } else {
    const shareCard = page
      .locator('[data-testid="share-code"], [data-testid="share-card"], [data-testid="room-info"], [data-testid="share-details"]')
      .first();
    if ((await shareCard.count()) > 0) {
      console.log('share-card text:', await shareCard.innerText());
    } else {
      console.log('share-card missing');
    }
  }
  const mainText = await page.locator('main').innerText();
  console.log('main snippet:', mainText.slice(0, 2000));
  await browser.close();
})();
