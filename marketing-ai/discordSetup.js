#!/usr/bin/env node
/** List Discord text channels — copy DISCORD_CHANNEL_ID into .env */

import { loadMarketingEnv } from "./loadEnv.js";
import { listDiscordChannels } from "./platforms/discord.js";

loadMarketingEnv();

listDiscordChannels().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
