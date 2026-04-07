import { chromium } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = (process.env.BASE_URL ?? "https://knowsygame.netlify.app").replace(/\/$/, "");
const AUTH_URL = `${BASE_URL}/auth`;
const AUTH_EMAIL = process.env.KNOWSY_EMAIL ?? process.env.AUTH_EMAIL ?? "richelle2305@gmail.com";
const AUTH_PASSWORD = process.env.KNOWSY_PASSWORD ?? process.env.AUTH_PASSWORD ?? "Richelle23#";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(AUTH_URL);
  await page.getByPlaceholder("you@example.com").fill(AUTH_EMAIL);
  await page.getByLabel("Password").fill(AUTH_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard|game|home/, { timeout: 20000 });
  console.log("logged in", await page.url());
  const dropdownTrigger = page.locator('[aria-haspopup="menu"]').first();
  await dropdownTrigger.click();
  await page.waitForTimeout(1000);
  const menuText = await page.locator('[data-radix-popper-content-wrapper]').innerText();
  console.log("menu text:\n", menuText);
  const signOutTexts = await page.locator('text=/sign out/i').allInnerTexts();
  console.log("sign out matches:", signOutTexts);
  const roles = await page.locator('[data-radix-popper-content-wrapper] button').allInnerTexts();
  console.log('buttons inside popper:', roles);
  await browser.close();
})();
