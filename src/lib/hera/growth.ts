import {
  HERA_BASE_MAJOR,
  HERA_BASE_MINOR,
  HERA_VERSION_CHANGED,
  HERA_XP_PER_MINOR,
} from "../../config/heraVersion";

export type HeraGrowthEvent = "reply" | "archive" | "helpful" | "day";

export type HeraVersion = {
  major: number;
  minor: number;
  /** e.g. "1.2" — UI only. Hera never says this. */
  tag: string;
  xp: number;
  nextXp: number;
};

type GrowthStore = {
  xp: number;
  replies: number;
  archives: number;
  helpful: number;
  lastDay: string;
  lastTickAt: number;
};

const STORAGE_KEY = "synexus_hera_growth";
/** Quiet background growth — 1 XP every 3 minutes she exists, capped per tick. */
const MS_PER_TIME_XP = 180_000;
const MAX_TIME_XP_PER_TICK = 4;

const XP: Record<HeraGrowthEvent, number> = {
  reply: 1,
  archive: 3,
  helpful: 2,
  day: 1,
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyStore(): GrowthStore {
  return { xp: 0, replies: 0, archives: 0, helpful: 0, lastDay: "", lastTickAt: Date.now() };
}

function readStore(): GrowthStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<GrowthStore>;
    return {
      xp: Number(parsed.xp) || 0,
      replies: Number(parsed.replies) || 0,
      archives: Number(parsed.archives) || 0,
      helpful: Number(parsed.helpful) || 0,
      lastDay: typeof parsed.lastDay === "string" ? parsed.lastDay : "",
      lastTickAt: Number(parsed.lastTickAt) || Date.now(),
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: GrowthStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function emitIfBumped(prevXp: number, nextXp: number): void {
  const prevTag = versionFromXp(prevXp).tag;
  const version = versionFromXp(nextXp);
  if (version.tag === prevTag) return;
  try {
    window.dispatchEvent(new CustomEvent(HERA_VERSION_CHANGED, { detail: version }));
  } catch {
    /* ignore */
  }
}

/** She keeps getting a little sharper in the background — no announcement. */
function applyTimeGrowth(store: GrowthStore): GrowthStore {
  const now = Date.now();
  const elapsed = Math.max(0, now - (store.lastTickAt || now));
  const gained = Math.min(MAX_TIME_XP_PER_TICK, Math.floor(elapsed / MS_PER_TIME_XP));
  if (!gained) {
    return { ...store, lastTickAt: store.lastTickAt || now };
  }
  return { ...store, xp: store.xp + gained, lastTickAt: now };
}

export function versionFromXp(xp: number): HeraVersion {
  const steps = Math.max(0, Math.floor(xp / HERA_XP_PER_MINOR));
  const totalMinor = HERA_BASE_MINOR + steps;
  const major = HERA_BASE_MAJOR + Math.floor(totalMinor / 10);
  const minor = totalMinor % 10;
  const used = steps * HERA_XP_PER_MINOR;
  return {
    major,
    minor,
    tag: `${major}.${minor}`,
    xp,
    nextXp: used + HERA_XP_PER_MINOR,
  };
}

export function readHeraVersion(): HeraVersion {
  const next = applyTimeGrowth(readStore());
  writeStore(next);
  return versionFromXp(next.xp);
}

/** "Hera 1.2" — silent UI tag only. Never put this in her spoken name. */
export function formatHeraTaggedName(name: string, version = readHeraVersion()): string {
  const base = name.trim() || "Hera";
  if (/\s\d+\.\d+$/.test(base)) return base;
  return `${base} ${version.tag}`;
}

/** 0–1 sharpness from lived experience — used to answer a bit quicker. */
export function heraSharpness(): number {
  return Math.min(1, readHeraVersion().xp / 36);
}

export function recordHeraGrowth(event: HeraGrowthEvent): HeraVersion {
  const before = applyTimeGrowth(readStore());
  const next = { ...before };

  if (event === "day") {
    const day = todayKey();
    if (next.lastDay === day) {
      writeStore(next);
      return versionFromXp(next.xp);
    }
    next.lastDay = day;
  }

  next.xp += XP[event];
  if (event === "reply") next.replies += 1;
  if (event === "archive") next.archives += 1;
  if (event === "helpful") next.helpful += 1;
  next.lastTickAt = Date.now();

  writeStore(next);
  emitIfBumped(before.xp, next.xp);
  return versionFromXp(next.xp);
}

/** Call when Hera opens — quiet day + time drip. */
export function touchHeraGrowthDay(): HeraVersion {
  return recordHeraGrowth("day");
}
