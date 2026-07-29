/**
 * Verify GA4 is wired: measurement ID in bundle + gtag page_view request in browser.
 *   npm run ga4:check
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEASUREMENT_ID = "G-N7W1GFMFC2";
const PREVIEW_PORT = 4173;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}/`;

function assertBundleContainsGaId() {
  const assetsDir = join(root, "dist", "assets");
  const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
  const hit = files.some((name) => {
    const body = readFileSync(join(assetsDir, name), "utf8");
    return body.includes(MEASUREMENT_ID) && body.includes("googletagmanager.com/gtag/js");
  });
  if (!hit) {
    throw new Error(`Build output missing GA4 (${MEASUREMENT_ID}) or gtag loader.`);
  }
  console.log("OK — production bundle includes GA4 measurement ID + gtag loader.");
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const marketingPlaywright = join(root, "marketing-ai", "node_modules", "playwright", "index.mjs");
    return import(pathToFileURL(marketingPlaywright).href);
  }
}

async function assertPageViewRequest() {
  const { chromium } = await loadPlaywright();
  const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(PREVIEW_PORT)], {
    cwd: root,
    shell: true,
    stdio: "ignore",
  });

  const hits = [];
  let browser;

  try {
    await waitForServer(PREVIEW_URL, 30_000);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on("request", (request) => {
      const url = request.url();
      if (/google-analytics\.com|analytics\.google\.com|googletagmanager.com.*collect/.test(url)) {
        hits.push(url);
      }
    });

    await page.goto(PREVIEW_URL, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const dl = window.dataLayer ?? [];
        return dl.some((entry) => Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view");
      },
      { timeout: 15_000 },
    );

    const dataLayerHits = await page.evaluate(() => {
      const dl = window.dataLayer ?? [];
      return dl.filter((entry) => Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view").length;
    });

    await page.click('a[href="/about"]', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const dataLayerHitsAfterNav = await page.evaluate(() => {
      const dl = window.dataLayer ?? [];
      return dl.filter((entry) => Array.isArray(entry) && entry[0] === "event" && entry[1] === "page_view").length;
    });

    if (dataLayerHits === 0) {
      throw new Error("No GA4 page_view events in dataLayer.");
    }

    console.log(`OK — GA4 page_view in dataLayer: ${dataLayerHits} (initial), ${dataLayerHitsAfterNav} (after nav).`);

    if (hits.length > 0) {
      console.log(`OK — GA4 network collect request(s): ${hits.length}`);
      console.log(`  sample: ${hits[0].slice(0, 120)}…`);
    } else {
      console.log("Note — no network collect captured (ad block / beacon); dataLayer page_view confirmed.");
    }
  } finally {
    if (browser) await browser.close();
    preview.kill("SIGTERM");
  }
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Preview server did not start at ${url}`);
}

async function main() {
  assertBundleContainsGaId();
  await assertPageViewRequest();
  console.log("\nGA4 verification passed.\n");
}

main().catch((err) => {
  console.error("FAIL —", err.message ?? err);
  process.exit(1);
});
