# Playwright Test Explanations

This document explains common Playwright concepts used in our tests.

---

## 1. Why `.spec.ts`?

### Answer
The `.spec.ts` file extension is a Playwright convention:
- `.spec.ts` = Specification Test File
- It tells Playwright "this is a test file"
- The `ts` extension means TypeScript

### Example
```
signin.spec.ts   ✓ Playwright will run this
signin.ts        ✗ Playwright will ignore this
```

---

## 2. Why `{ name: /sign in/i }`?

### Answer
This is a **locator** with **regex** and **flags**:

```typescript
{ name: /sign in/i }
```

| Part | Meaning |
|------|---------|
| `name:` | Look for text in element |
| `/sign in/` | Regular expression pattern |
| `i` | **Case-insensitive** flag |

### Why `i` flag?
- Matches "Sign In", "SIGN IN", "sign in" all the same
- More flexible matching

### Equivalent without regex
```typescript
// With regex (recommended)
{ name: /sign in/i }

// Without regex
{ name: 'Sign In' }  // Exact match only
```

---

## 3. Why `await page.waitForTimeout(500)`?

### Answer
This waits for **500 milliseconds**:

```typescript
await page.waitForTimeout(500);  // Wait 0.5 seconds
```

### Why use it?
1. **Let page render** - Give UI time to update
2. **Wait for animations** - CSS transitions complete
3. **Avoid flaky tests** - Let dynamic content load

### When to use?
- After typing, before checking result
- After clicking, before next action
- Before checking counter updates

### Note
Don't overuse - it slows tests. Only when needed.

---

## 4. Why `await page.waitForLoadState('domcontentloaded')`?

### Answer
This waits for the **page to be ready**:

```typescript
await page.waitForLoadState('domcontentloaded');
```

### Types of Load States

| State | What it waits for |
|-------|------------------|
| `domcontentloaded` | HTML loaded, no images yet |
| `load` | Page fully loaded (images, etc) |
| `networkidle` | No network requests for 500ms |

### When to use each?

| State | Use Case |
|-------|----------|
| `domcontentloaded` | Fast, enough for most tests |
| `load` | When you need images |
| `networkidle` | When waiting for API calls |

### Why use it?
1. **Prevents errors** - Element might not exist yet
2. **Reliable tests** - Page is ready before actions
3. **Better debugging** - Know page is loaded

---

## Quick Reference - Common Selectors

```typescript
// By role (recommended)
page.getByRole('button', { name: 'Submit' })
page.getByRole('textbox', { name: 'Email' })

// By placeholder
page.getByPlaceholder('you@example.com')

// By text
page.getByText('Welcome')

// By test ID
page.getByTestId('submit-button')

// By label
page.getByLabel('Email')
```

---

## Common Commands Explained

```typescript
// Click a button
await page.click('button');

// Type in input
await page.fill('input', 'text');

// Check if visible
await expect(locator).toBeVisible();

// Check text content
await expect(locator).toHaveText('Hello');
```

---

## Summary Table

| Code | Purpose |
|------|---------|
| `.spec.ts` | Test file extension |
| `/regex/i` | Case-insensitive regex |
| `waitForTimeout(500)` | Wait 500ms |
| `waitForLoadState('domcontentloaded')` | Wait page ready |
| `getByRole` | Find by ARIA role |
| `getByPlaceholder` | Find by placeholder text |
