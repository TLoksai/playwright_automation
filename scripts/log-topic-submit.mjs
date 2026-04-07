import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://knowsy.game/');
  const playNowLink = page.getByRole('link', { name: /play now/i }).first();
  if (await playNowLink.isVisible().catch(() => false)) {
    await playNowLink.click();
  } else {
    await page.getByRole('button', { name: /start playing/i }).first().click();
  }
  await page.getByPlaceholder('Enter your name').first().fill('Inspector');
  await page.getByRole('button', { name: /create game room/i }).click();
  await page.getByText('Add AI Player', { exact: true }).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByText('Add AI Player', { exact: true }).click();
  await page.getByText('Start Game', { exact: true }).click();
  await page.getByRole('heading', { name: /topic selection/i }).waitFor({ state: 'visible', timeout: 60000 });
  await page.getByRole('button', { name: 'Most Adorable Pet' }).first().click();
  for (const option of ['Bunnies', 'Cats', 'Hamsters', 'Dogs', 'Birds']) {
    await page.getByRole('button', { name: option }).first().click();
  }
  page.on('request', (request) => {
    if (request.url().includes('supabase')) {
      console.log('request', request.method(), request.url());
    }
  });
  page.on('response', async (response) => {
    if (response.url().includes('supabase')) {
      console.log('response', response.status(), response.url());
    }
  });
  await page.getByRole('button', { name: /submit selection/i }).click();
  await page.waitForTimeout(5000);
  await browser.close();
})();
