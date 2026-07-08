/**
 * Smoke test: bottom nav Login/Titan sheets open and toggle correctly.
 * Run: node scripts/smoke-nav-buttons.mjs
 */
import { chromium } from "../marketing-ai/node_modules/playwright/index.mjs";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5175";

async function skipBoot(page) {
  const skip = page.locator(".synexus-boot");
  if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skip.click();
    await skip.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];

  page.on("pageerror", (err) => errors.push(String(err)));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await skipBoot(page);

  const nav = page.getByRole("navigation", { name: "Primary" });
  const loginBtn = nav.getByRole("button", { name: /Login|Account/ });
  const titanBtn = nav.getByRole("button", { name: /Titan|Sentinels/ });

  // Titan opens chat sheet
  await titanBtn.click();
  await page.getByRole("dialog", { name: /Talk to|Titan|Sentinels/i }).waitFor({ timeout: 5000 });
  const chatComposer = page.getByRole("textbox", { name: /Message to/i });
  if (!(await chatComposer.isVisible())) {
    throw new Error("Titan chat composer not visible");
  }

  // Titan toggles closed
  await titanBtn.click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });

  // Login opens login sheet
  await loginBtn.click();
  await page.getByRole("dialog", { name: "Sign in" }).waitFor({ timeout: 5000 });
  await page.getByRole("tab", { name: "Sign in" }).waitFor();
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Username").waitFor();

  // Switch to Titan while login open (nav stays clickable)
  await titanBtn.click();
  await page.getByRole("dialog", { name: /Talk to|Titan|Sentinels/i }).waitFor({ timeout: 5000 });
  await chatComposer.waitFor();

  // Login switches back from Titan
  await loginBtn.click();
  await page.getByRole("dialog", { name: "Sign in" }).waitFor({ timeout: 5000 });

  // Login toggles closed
  await loginBtn.click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });

  // Feed nav closes any sheet and navigates
  await titanBtn.click();
  await page.getByRole("dialog").waitFor({ timeout: 5000 });
  await nav.getByRole("link", { name: /Scan|Feed/ }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });

  if (errors.length) {
    throw new Error(`Page errors: ${errors.join("; ")}`);
  }

  console.log("OK — Login and Titan nav buttons behave correctly.");
  await browser.close();
}

main().catch((err) => {
  console.error("FAIL —", err.message ?? err);
  process.exit(1);
});
