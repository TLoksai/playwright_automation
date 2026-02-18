# Understanding getByPlaceholder vs fill

## The Question
```
const emailInput = page.getByPlaceholder('you@example.com').first();
await emailInput.fill('invalidemail');

const passwordInput = page.getByPlaceholder('password').nth(1);
await passwordInput.fill('Loksai@12345');
```

## Explanation

### Two Different Things!

| Part | Purpose |
|------|---------|
| `getByPlaceholder('you@example.com')` | **Finding** the input field |
| `.fill('invalidemail')` | **Entering** the value |

---

## In Simple Terms

```javascript
// Step 1: FIND the input (look at the placeholder attribute in HTML)
getByPlaceholder('you@example.com')
// This finds: <input placeholder="you@example.com">

// Step 2: FILL with value (type into the found input)
.fill('invalidemail')
// This types: invalidemail into the input
```

---

## What's the Difference?

| Method | What it does |
|--------|--------------|
| `getByPlaceholder('xyz')` | Finds the input field with placeholder="xyz" |
| `.fill('abc')` | Types "abc" into that input field |

---

## Example

```html
<!-- HTML -->
<input type="email" placeholder="you@example.com">
<input type="password" placeholder="password">
```

```javascript
// Find email input by placeholder, then fill with test email
page.getByPlaceholder('you@example.com').fill('test@example.com')

// Find password input by placeholder, then fill with test password  
page.getByPlaceholder('password').fill('TestPassword123')
```

---

## In Your Example

```javascript
// This is CORRECT:
getByPlaceholder('you@example.com')  // Find field with this placeholder
.fill('invalidemail')               // Fill with this value

getByPlaceholder('password')        // Find password field
.fill('Loksai@12345')              // Fill with this value
```

---

## Summary

| Don't Put | Put In |
|-----------|--------|
| Email/password values | `.fill()` |
| Placeholder text (from HTML) | `getByPlaceholder()` |

**Placeholder** = The hint text in the input field (like "you@example.com")
**Fill** = The actual value you want to type in
