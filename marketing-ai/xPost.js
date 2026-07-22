#!/usr/bin/env node
/**
 * Verify X credentials or post a test video.
 *
 *   npm run x:check
 *   npm run x:post -- path/to/video.mp4 "Caption text"
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMarketingEnv } from "./loadEnv.js";
import { checkX, publishX, verifyXCredentials } from "./platforms/xTwitter.js";
import { fileExists } from "./videoPipeline.js";

loadMarketingEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    console.log(`SyNexus X tools

  npm run x:check              Verify @account + API keys
  npm run x:post -- [video]    Post one MP4 to X (default: launch day-1 slot 0)
`);
    return;
  }

  if (args.includes("--check") || args.length === 0) {
    const result = await checkX();
    if (result.ok) {
      console.log(`\n✓ X ready · ${result.mode}`);
    } else {
      console.error(`\n✗ X not ready`);
      if (result.error) console.error(`  ${result.error}`);
      if (result.fix) console.error(`  Fix: ${result.fix}`);
      process.exitCode = 1;
    }
    return;
  }

  const videoArg = args.find((a) => a.endsWith(".mp4"));
  const captionArg = args.find((a) => !a.startsWith("-") && !a.endsWith(".mp4"));
  const defaultVideo = join(__dirname, "output", "launch", "day-01", "d1-s1.mp4");
  const videoPath = videoArg || defaultVideo;
  const caption =
    captionArg ||
    "Should I buy this? SyNexus scans any Solana token — Avoid, Watch, or OK.\n\nTry free → https://synexus.pro\n\n#SyNexus #Solana #Crypto";

  if (!(await fileExists(videoPath))) {
    console.error(`Video not found: ${videoPath}`);
    console.error("Run: npm run launch:render -- --day 1");
    process.exit(1);
  }

  const verify = await verifyXCredentials();
  if (!verify.ok) {
    console.error(verify.error || "X credentials invalid");
    process.exit(1);
  }
  console.log(`Posting as @${verify.screenName}…`);

  const dayDir = dirname(videoPath);
  await publishX({ dayDir, videoPath, caption, slot: 0, quiet: false });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
