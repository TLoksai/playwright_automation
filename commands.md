# Playwright Test Commands

A quick reference guide for running tests in this project.

---

## 🚀 Basic Commands

### Run All Tests
```bash
npm test
```
Runs all tests in headless mode across all browsers.

### Run in UI Mode (Recommended for debugging)
```bash
npm run test:ui
```
Opens interactive UI where you can click tests and see real-time execution.

---

## 🎯 Run Specific Test Files

### Run Only Sign In Tests
```bash
npx playwright test tests/e2e/signin.spec.ts
```

### Run Only Sign Up Tests
```bash
npx playwright test tests/e2e/signup.spec.ts
```

---

## 📱 Responsive/Mobile Tests

### Run Only Mobile Browsers
```bash
npx playwright test --project="Chrome Mobile"
npx playwright test --project="Safari Mobile"
```

### Run Only Tablet (iPad)
```bash
npx playwright test --project="Safari iPad"
```

### Run Desktop Only
```bash
npx playwright test --project="Chrome Web"
npx playwright test --project="Safari Web"
```

---

## 🖥️ Run on Specific Browser

### Chrome
```bash
npx playwright test --project="Chrome Web"
npx playwright test --project="Chrome Tab"
npx playwright test --project="Chrome Mobile"
```

### Safari
```bash
npx playwright test --project="Safari Web"
npx playwright test --project="Safari iPad"
npx playwright test --project="Safari Mobile"
```

---

## 🔍 Debugging

### Run in Debug Mode
```bash
npx playwright test --debug
```
Opens debugger with step-by-step execution.

### Run Headed (See browser)
```bash
npx playwright test --headed
```

### Run Single Test
```bash
npx playwright test tests/e2e/signin.spec.ts -g "should display"
```

---

## 🔍 List Tests (Before Running)

### List All Tests
```bash
npx playwright test --list
```
Shows all test cases without running them.

### List Tests in Specific File
```bash
npx playwright test tests/e2e/signin.spec.ts --list
npx playwright test tests/e2e/signup.spec.ts --list
```

### List Tests by Pattern
```bash
npx playwright test -g "signin" --list
npx playwright test -g "signup" --list
```

---

## 📊 Reports & Logs

### View HTML Report
```bash
npm run test:report
```
Opens detailed HTML report in browser.

### List All Tests (Without Running)
```bash
npx playwright test --list
```

---

## ⚙️ Other Useful Commands

### Update Snapshots
```bash
npx playwright test --update-snapshots
```

### Run Tests with Slow Motion
```bash
npx playwright test --slowmo=500
```

### Run Tests in Parallel
```bash
npx playwright test
```
(Already configured to run in parallel by default)

---

## 📁 Project Structure

```
tests/
└── e2e/
    ├── signin.spec.ts   # Sign In tests
    └── signup.spec.ts   # Sign Up tests
```

---

## 🌐 Browser Projects Configured

| Project Name | Device |
|--------------|--------|
| Chrome Web | Desktop Chrome |
| Chrome Tab | Galaxy Tab S4 |
| Chrome Mobile | Pixel 5 |
| Safari Web | Desktop Safari |
| Safari iPad | iPad Pro |
| Safari Mobile | iPhone 12 |

---

## 💡 Tips for Interns

1. **List tests first** to see what you'll run: `npx playwright test --list`
2. **Use UI Mode** for debugging: `npm run test:ui`
3. **Run single test** when developing: `npx playwright test tests/e2e/signin.spec.ts -g "test name"`
4. **Check mobile first** when testing responsiveness
5. **Use --debug** when a test fails and you need to investigate
6. **Always check HTML report** after test runs to see failures
