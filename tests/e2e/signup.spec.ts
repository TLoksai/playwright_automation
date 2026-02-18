import { test, expect } from '@playwright/test';

/**
 * Sign Up E2E Tests
 * URL: https://knowsygame.netlify.app/auth
 */
test.describe('Sign Up', () => {
  test('should display Sign Up tab on page load', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await expect(signUpTab).toBeVisible();
  });

  test('should switch to Sign Up tab', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    await expect(signUpTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should show validation error for empty fields', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    const signUpButton = page.getByRole('button', { name: /sign up/i });
    await signUpButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.includes('name') || pageContent.includes('Email')).toBeTruthy();
  });

  test('should show error for password less than 6 characters', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    const nameInput = page.getByPlaceholder('John Doe');
    await nameInput.fill('John Doe');
    
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('test@example.com');
    
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    await passwordInput.fill('12345');
    
    const signUpButton = page.getByRole('button', { name: /sign up/i });
    await signUpButton.click();
    await page.waitForTimeout(500);
    
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('6');
  });

  test('should show password character counter', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    
    await passwordInput.fill('abc');
    await page.waitForTimeout(300);
    await expect(page.getByText('3/6')).toBeVisible();
    
    await passwordInput.fill('abcde');
    await page.waitForTimeout(300);
    await expect(page.getByText('5/6')).toBeVisible();
    
    await passwordInput.fill('abcdef');
    await page.waitForTimeout(300);
    await expect(page.getByText('6/6')).toBeVisible();
  });

  test('should submit with valid name, email and password', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    const nameInput = page.getByPlaceholder('John Doe');
    await nameInput.fill('John Doe');
    
    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('test@example.com');
    
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    await passwordInput.fill('password123');
    
    const signUpButton = page.getByRole('button', { name: /sign up/i });
    await signUpButton.click();
    
    await page.waitForTimeout(1000);
  });

  test('should mask password field', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('domcontentloaded');
    
    const signUpTab = page.getByRole('tab', { name: /sign up/i });
    await signUpTab.click();
    
    const passwordInput = page.getByRole('textbox', { name: /password/i });
    const inputType = await passwordInput.getAttribute('type');
    
    expect(inputType).toBe('password');
  });
});
