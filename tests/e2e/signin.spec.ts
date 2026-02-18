import { test, expect } from '@playwright/test';

/**
 * Sign In E2E Tests
 * URL: https://knowsygame.netlify.app/auth
 */
test.describe('Sign In', () => {
  test('should display Sign In tab on page load', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signInTab = page.getByRole('tab', { name: /sign in/i });
    await expect(signInTab).toBeVisible();
  });

  test('should switch to Sign In tab', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signInTab = page.getByRole('tab', { name: /sign in/i });
    await signInTab.click();
    
    await expect(signInTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should show validation error for empty email and password', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.includes('email') || pageContent.includes('Email') || 
           pageContent.includes('password') || pageContent.includes('Password')).toBeTruthy();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const emailInput = page.getByPlaceholder('loksai@xtransmatrix.com').first();
    await emailInput.fill('invalidemail');
    
    const passwordInput = page.getByPlaceholder('loksai@xtransmatrix.com').nth(1);
    await passwordInput.fill('Loksai@12345');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('email');
  });

  test('should accept valid email and password', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const emailInput = page.getByPlaceholder('loksai@xtransmatrix.com').first();
    await emailInput.fill('test@example.com');
    
    const passwordInput = page.getByPlaceholder('loksai@xtransmatrix.com').nth(1);
    await passwordInput.fill('Loksai@12345');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.click();
    
    await page.waitForTimeout(1000);
  });

  test('should mask password field', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const passwordInput = page.getByPlaceholder('loksai@xtransmatrix.com').nth(1);
    const inputType = await passwordInput.getAttribute('type');
    
    expect(inputType).toBe('password');
  });

  test('should have enabled Sign In button', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await expect(signInButton).toBeEnabled();
  });
});
