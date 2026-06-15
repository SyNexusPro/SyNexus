import { useEffect, useState } from "react";

export type SynexusUIMode = "simple" | "advanced";

const STORAGE_KEY = "synexus_ui_mode";

export const UI_MODE_CHANGED = "synexus-ui-mode-changed";

function normalizeMode(raw: string | null | undefined): SynexusUIMode {
  return raw === "advanced" ? "advanced" : "simple";
}

export function notifySynexusUIModeChanged(): void {
  window.dispatchEvent(new Event(UI_MODE_CHANGED));
}

export function readSynexusUIMode(): SynexusUIMode {
  try {
    return normalizeMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "simple";
  }
}

export function writeSynexusUIMode(mode: SynexusUIMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  notifySynexusUIModeChanged();
}

/** Simple = launch focus (scanner, wallet, Oracle). Advanced = full Sentinel grid & feeds. */
export function useSynexusUIMode() {
  const [mode, setModeState] = useState<SynexusUIMode>(() => readSynexusUIMode());

  useEffect(() => {
    const sync = () => setModeState(readSynexusUIMode());
    window.addEventListener("storage", sync);
    window.addEventListener(UI_MODE_CHANGED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(UI_MODE_CHANGED, sync);
    };
  }, []);

  function setMode(next: SynexusUIMode) {
    writeSynexusUIMode(next);
    setModeState(next);
  }

  return {
    mode,
    isSimple: mode === "simple",
    isAdvanced: mode === "advanced",
    setMode,
    toggleMode: () => setMode(mode === "simple" ? "advanced" : "simple"),
  };
}
