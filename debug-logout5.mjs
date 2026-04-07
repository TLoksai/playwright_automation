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
  const menuButton = page.locator('button[aria-haspopup="dialog"]').first();
  await menuButton.click();
  await page.waitForTimeout(500);
  const dialog = page.locator('[role="dialog"]');
  console.log('dialog text:\n', await dialog.innerText());
  const signOutItem = page.locator('[role="dialog"] >> text=/sign out/i');
  console.log('sign out exists?', await signOutItem.count());
  await browser.close();
})();
