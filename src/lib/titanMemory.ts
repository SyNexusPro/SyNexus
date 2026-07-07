/**
 * Titan personalized memory — opt-in only.
 * Stores preferences locally (and syncs to profile when available).
 */

export const TITAN_MEMORY_CONSENT_KEY = "synexus_titan_memory_consent";
export const TITAN_MEMORY_PROFILE_KEY = "synexus_titan_memory_profile";

export type TitanRiskTolerance = "conservative" | "balanced" | "aggressive";

export type TitanMemoryProfile = {
  favoriteSymbols: string[];
  riskTolerance: TitanRiskTolerance;
  tradingNotes: string;
  updatedAt: number;
};

const EMPTY_PROFILE: TitanMemoryProfile = {
  favoriteSymbols: [],
  riskTolerance: "balanced",
  tradingNotes: "",
  updatedAt: 0,
};

export function hasTitanMemoryConsent(): boolean {
  try {
    return localStorage.getItem(TITAN_MEMORY_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTitanMemoryConsent(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(TITAN_MEMORY_CONSENT_KEY, "1");
    } else {
      localStorage.removeItem(TITAN_MEMORY_CONSENT_KEY);
      localStorage.removeItem(TITAN_MEMORY_PROFILE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function loadTitanMemoryProfile(): TitanMemoryProfile {
  if (!hasTitanMemoryConsent()) return { ...EMPTY_PROFILE };
  try {
    const raw = localStorage.getItem(TITAN_MEMORY_PROFILE_KEY);
    if (!raw) return { ...EMPTY_PROFILE };
    const parsed = JSON.parse(raw) as Partial<TitanMemoryProfile>;
    return {
      favoriteSymbols: Array.isArray(parsed.favoriteSymbols)
        ? parsed.favoriteSymbols.filter((s) => typeof s === "string").slice(0, 12)
        : [],
      riskTolerance:
        parsed.riskTolerance === "conservative" ||
        parsed.riskTolerance === "aggressive" ||
        parsed.riskTolerance === "balanced"
          ? parsed.riskTolerance
          : "balanced",
      tradingNotes: typeof parsed.tradingNotes === "string" ? parsed.tradingNotes.slice(0, 500) : "",
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveTitanMemoryProfile(patch: Partial<TitanMemoryProfile>): TitanMemoryProfile {
  if (!hasTitanMemoryConsent()) return { ...EMPTY_PROFILE };
  const current = loadTitanMemoryProfile();
  const next: TitanMemoryProfile = {
    favoriteSymbols: patch.favoriteSymbols ?? current.favoriteSymbols,
    riskTolerance: patch.riskTolerance ?? current.riskTolerance,
    tradingNotes: patch.tradingNotes ?? current.tradingNotes,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(TITAN_MEMORY_PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function rememberFavoriteSymbol(symbol: string): void {
  if (!hasTitanMemoryConsent()) return;
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym.length > 12) return;
  const profile = loadTitanMemoryProfile();
  const favorites = [sym, ...profile.favoriteSymbols.filter((s) => s !== sym)].slice(0, 12);
  saveTitanMemoryProfile({ favoriteSymbols: favorites });
}

export function titanMemoryContextLine(): string | null {
  if (!hasTitanMemoryConsent()) return null;
  const profile = loadTitanMemoryProfile();
  const parts: string[] = [];
  if (profile.favoriteSymbols.length) {
    parts.push(`watching your favorites: ${profile.favoriteSymbols.slice(0, 5).join(", ")}`);
  }
  if (profile.riskTolerance !== "balanced") {
    parts.push(`${profile.riskTolerance} risk profile`);
  }
  if (!parts.length) return null;
  return parts.join(" · ");
}
