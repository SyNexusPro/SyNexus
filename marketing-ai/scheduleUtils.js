import { tiktokPostsPerDay } from "./platforms/tiktok.js";
import { SCHEDULE } from "./viralContentSystem.js";

/** Daily posts: 3 Shorts + 1 long-form (v1.0 viral system). */
export function postsPerDay() {
  const n = Number(process.env.POSTS_PER_DAY?.trim() || process.env.TIKTOK_POSTS_PER_DAY?.trim() || String(SCHEDULE.shortsPerDay));
  return Math.min(4, Math.max(1, Number.isFinite(n) ? n : SCHEDULE.shortsPerDay));
}

export function shortSlotsPerDay() {
  return Math.min(3, postsPerDay());
}

export function postHours() {
  const raw = process.env.POST_HOURS?.trim() || process.env.TIKTOK_POST_HOURS?.trim() || SCHEDULE.postHours.join(",");
  const hours = raw
    .split(",")
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);

  const count = postsPerDay();
  if (hours.length >= count) return hours.slice(0, count);

  return SCHEDULE.postHours.slice(0, count);
}

export function slotLabel(slot) {
  if (slot === SCHEDULE.longSlot) return "Long-form";
  return ["Short 1", "Short 2", "Short 3"][slot] || `Slot ${slot + 1}`;
}

export function isLongFormSlot(slot) {
  return slot === SCHEDULE.longSlot;
}

export function msUntilNextSlot(now = new Date()) {
  const hours = postHours();
  const candidates = [];

  for (let dayOffset = 0; dayOffset <= 1; dayOffset += 1) {
    for (const hour of hours) {
      const t = new Date(now);
      t.setDate(t.getDate() + dayOffset);
      t.setHours(hour, 0, 0, 0);
      if (t.getTime() > now.getTime()) candidates.push(t.getTime() - now.getTime());
    }
  }

  return candidates.length ? Math.min(...candidates) : 86_400_000;
}

export function currentSlotIndex(now = new Date()) {
  const hours = postHours();
  const h = now.getHours();
  const m = now.getMinutes();

  for (let i = hours.length - 1; i >= 0; i -= 1) {
    if (h > hours[i] || (h === hours[i] && m >= 0)) return i;
  }
  return -1;
}

export { tiktokPostsPerDay, SCHEDULE };
