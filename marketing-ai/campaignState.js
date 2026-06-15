import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "./videoPipeline.js";

export async function readCampaignState(dayDir) {
  const path = join(dayDir, "campaign.json");
  if (!(await fileExists(path))) return { platforms: {} };
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { platforms: {} };
  }
}

export async function writeCampaignState(dayDir, state) {
  const path = join(dayDir, "campaign.json");
  const next = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return path;
}

export function wasPosted(state, platform) {
  return Boolean(state?.platforms?.[platform]?.postedAt || state?.platforms?.[platform]?.videoId);
}
