import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://knowsy.game/');
 // await page.getByRole('link', { name: 'Play Now' }).click();
  const playBtn = page.getByRole('link', { name: /play now|start play/i });
  await playBtn.first().click();
  const createRoomButton = page.getByRole('button', { name: 'Create Game Room' });
  const hostNameInput = page.getByRole('textbox', { name: 'Enter your name' }).first();
  await hostNameInput.fill('Room Host');
  await expect(createRoomButton).toBeEnabled({ timeout: 15000 });
  await createRoomButton.click();
  const addAiButton = page.getByRole('button', { name: /add ai player/i });
  await addAiButton.waitFor({ state: 'visible', timeout: 60000 });
  await addAiButton.click();
  await page.getByRole('button', { name: 'Start Game' }).click();
  await page.getByRole('button', { name: 'Most Adorable Pet' }).click();
  await page.getByRole('button', { name: 'Bunnies' }).click();
  await page.getByRole('button', { name: 'Cats' }).click();
  await page.getByRole('button', { name: 'Hamsters' }).click();
  await page.getByRole('button', { name: 'Dogs' }).click();
  await page.getByRole('button', { name: 'Birds' }).click();
  await page.waitForTimeout(1000);
  // const options = page.locator('.option-item'); // TODO: replace with correct parent selector

    // STEP 3 - locate drag handles
    const dragHandles = page.locator('svg.lucide-grip-vertical');

    // ASSERT 1 - drag handles exist
    await expect(dragHandles.nth(0)).toBeVisible();
    await expect(dragHandles.nth(1)).toBeVisible();

    await expect(dragHandles.nth(2)).toBeVisible();

    await expect(dragHandles.nth(3)).toBeVisible();

    await expect(dragHandles.nth(4)).toBeVisible();  // straight of this ahndler there is text get that text
    

    // await dragHandles.nth(1).dragTo(dragHandles.nth(2));   
await dragHandles.nth(2).hover();
await page.mouse.down();
// await dragHandles.nth(2).hover();
// move it up by 100px
await page.mouse.move(0, -100);
await page.mouse.up();
    // await dragHandles.nth(2).dragTo(dragHandles.nth(3));  
    // await dragHandles.nth(4).dragTo(dragHandles.nth(0));

    // await expect(options.first()).toBeVisible();
});
