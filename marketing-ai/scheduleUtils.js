import { tiktokPostsPerDay } from "./platforms/tiktok.js";

/** Shared 3× daily posting schedule (Telegram, YouTube, TikTok). */
export function postsPerDay() {
  const n = Number(process.env.POSTS_PER_DAY?.trim() || process.env.TIKTOK_POSTS_PER_DAY?.trim() || "3");
  return Math.min(3, Math.max(1, Number.isFinite(n) ? n : 3));
}

export function postHours() {
  const raw = process.env.POST_HOURS?.trim() || process.env.TIKTOK_POST_HOURS?.trim() || "9,14,20";
  const hours = raw
    .split(",")
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);

  const count = postsPerDay();
  if (hours.length >= count) return hours.slice(0, count);

  return [9, 14, 20].slice(0, count);
}

export function slotLabel(slot) {
  return ["Morning", "Midday", "Evening"][slot] || `Slot ${slot + 1}`;
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

export { tiktokPostsPerDay };
