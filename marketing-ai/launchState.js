import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function outputRoot() {
  return process.env.VIDEO_OUTPUT_DIR?.trim() || join(__dirname, "output");
}

export function launchRoot() {
  return join(outputRoot(), "launch");
}

export function launchDayPath(dayNumber) {
  return join(launchRoot(), `day-${String(dayNumber).padStart(2, "0")}`);
}

export function launchStatePath() {
  return join(launchRoot(), "launch-state.json");
}

const DEFAULT_STATE = {
  version: 1,
  startedAt: null,
  winners: [],
  posted: {},
  metrics: {},
};

export async function readLaunchState() {
  try {
    const raw = await readFile(launchStatePath(), "utf8");
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function writeLaunchState(state) {
  await mkdir(launchRoot(), { recursive: true });
  await writeFile(launchStatePath(), JSON.stringify(state, null, 2), "utf8");
}

export async function recordWinner(scriptId, metric = {}) {
  const state = await readLaunchState();
  const existing = state.winners.find((w) => w.id === scriptId);
  if (!existing) {
    state.winners.push({ id: scriptId, recordedAt: new Date().toISOString(), ...metric });
  } else {
    Object.assign(existing, metric, { updatedAt: new Date().toISOString() });
  }
  state.winners.sort((a, b) => (b.views || 0) - (a.views || 0));
  await writeLaunchState(state);
  return state;
}

export async function getWinnersForDay6(allScripts) {
  const state = await readLaunchState();
  if (!state.winners.length) return [];
  const byId = new Map(allScripts.map((s) => [s.id, s]));
  return state.winners.map((w) => byId.get(w.id)).filter(Boolean);
}
