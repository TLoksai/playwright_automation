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
  await page.waitForTimeout(5000);
  console.log('url after wait', page.url());
  const signOutTexts = await page.locator('text=/sign out/i').evaluateAll(nodes => nodes.map(n => n.outerHTML));
  console.log('sign-out elements found:', signOutTexts.length);
  console.log(signOutTexts);
  await browser.close();
})();
