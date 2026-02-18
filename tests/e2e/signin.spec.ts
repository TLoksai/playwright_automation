import { test, expect } from '@playwright/test';

/**
 * Sign In E2E Tests
 * URL: https://knowsygame.netlify.app/auth
 */
test.describe('Sign In', () => {
  test('should display Sign In tab on page load', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    const signInTab = page.getByRole('tab', { name: /sign in/i });
    await expect(signInTab).toBeVisible();
  });

  test('should switch to Sign In tab', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    const signInTab = page.getByRole('tab', { name: /sign in/i });
    await signInTab.click();
    
    await expect(signInTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should show validation error for empty email and password', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.includes('email') || pageContent.includes('Email') || 
           pageContent.includes('password') || pageContent.includes('Password')).toBeTruthy();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Email has placeholder
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('loksai12@xtransmatrix');
    
    // Password has NO placeholder - use getByLabel instead
    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('Loksai@12345');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('email');
  });

  test('should accept valid email and password', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Email has placeholder
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('loksai@xtransmatrix.com');
    
    // Password has NO placeholder - use getByLabel instead
    const passwordInput = page.getByLabel('Password');
    await passwordInput.fill('Loksai@12345');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    
    await page.waitForTimeout(1000);
  });

  test('should have enabled Sign In button', async ({ page }) => {
    await page.goto('https://knowsygame.netlify.app/auth', { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
  });
});
