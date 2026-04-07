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
  const dropdowns = page.locator('[aria-haspopup="menu"]');
  const count = await dropdowns.count();
  console.log('dropdown triggers:', count);
  for (let i = 0; i < count; i++) {
    const el = dropdowns.nth(i);
    console.log(i, await el.evaluate((node) => node.outerHTML));
  }
  await browser.close();
})();
