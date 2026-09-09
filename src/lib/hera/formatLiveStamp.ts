/** Shared live-data timestamp formatting for Hera ranked answers — accurate to the second. */

const CLOCK_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short",
};

export function hostTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatHeraDataAsOf(
  date: Date | string | number = new Date(),
  timeZone?: string | null,
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleTimeString(undefined, {
      ...CLOCK_OPTS,
      ...(timeZone ? { timeZone } : {}),
    });
  } catch {
    return d.toLocaleTimeString(undefined, CLOCK_OPTS);
  }
}

export function heraDataAsOfLine(
  date: Date | string | number = new Date(),
  source?: string,
  timeZone?: string | null,
): string {
  const time = formatHeraDataAsOf(date, timeZone);
  return source ? `✓ Data as of ${time} · ${source}` : `✓ Data as of ${time}`;
}

/** Qualitative blurb from momentum / liquidity style metrics. */
export function heraRankReason(opts: {
  index: number;
  changePct: number;
  volumeUsd?: number;
  liquidityUsd?: number;
  losers?: boolean;
}): string {
  const { index, changePct, volumeUsd = 0, liquidityUsd = 0, losers } = opts;
  if (losers) {
    if (index === 0) return "Steepest drop with still-visible volume.";
    if (index === 1) return "Heavy selling pressure — risk radar, not a buy list.";
    return "Weaker tape; useful mainly as a caution set.";
  }
  const highVol = volumeUsd >= 250_000;
  const solidLiq = liquidityUsd >= 100_000;
  const hot = changePct >= 15;
  if (index === 0) {
    if (highVol && solidLiq) return "High volume. Strong trend. Healthier liquidity.";
    if (hot) return "Strongest momentum right now — verify liquidity before sizing.";
    return "Best mix of momentum, volume, and liquidity in this window.";
  }
  if (index === 1) {
    return hot ? "Accelerating volume and buying pressure, but more volatile." : "Solid follow-through with visible volume.";
  }
  if (solidLiq) return "Less explosive, but liquidity and trend look healthier.";
  return "Worth watching — still verify mint and risk before you size.";
}
