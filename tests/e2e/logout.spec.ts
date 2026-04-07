import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://knowsy.game/');
  if (await page.getByRole('link', { name: 'Sign In' }).isVisible()) {
  await page.getByRole('link', { name: 'Sign In' }).click();

  await page.getByRole('textbox', { name: 'Email' }).click();
  await page.getByRole('textbox', { name: 'Email' }).fill('richelle2305@gmail.com');
  await page.getByRole('textbox', { name: 'Email' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('Richelle23#');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('img').nth(4)).toBeVisible();
  await page.getByRole('img').nth(4).click({timeout: 3000});
  await page.getByRole('button', { name: 'Sign out' }).click();

  }
  else{
    await page.getByRole('img').nth(4).click({timeout: 5000});
    await page.getByRole('textbox', { name: 'Email' }).fill('richelle2305@gmail.com');
  await page.getByRole('textbox', { name: 'Email' }).press('Tab');
  await page.getByRole('textbox', { name: 'Password' }).fill('Richelle23#');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('img').nth(0)).toBeVisible({timeout: 8000});
  await page.getByRole('img').nth(0).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  }
  
  // await page.getByRole('img').nth(3).click({timeout: 5000});

  // await page.getByRole('button', { name: 'Sign out' }).click();
});