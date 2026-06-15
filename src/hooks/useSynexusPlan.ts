import { useEffect, useState } from "react";
import { normalizeSynexusPlan, PLAN_STORAGE_KEY, type SynexusPlan } from "../lib/tradingFees";

export const SYNEXUS_PLAN_CHANGED = "synexus-plan-changed";

export function notifySynexusPlanChanged(): void {
  window.dispatchEvent(new Event(SYNEXUS_PLAN_CHANGED));
}

/** Reads the active Synexus plan from local storage (Pro discount applies on this device). */
export function useSynexusPlan(): SynexusPlan {
  const [plan, setPlan] = useState<SynexusPlan>(() =>
    normalizeSynexusPlan(localStorage.getItem(PLAN_STORAGE_KEY)),
  );

  useEffect(() => {
    const sync = () => setPlan(normalizeSynexusPlan(localStorage.getItem(PLAN_STORAGE_KEY)));
    window.addEventListener("storage", sync);
    window.addEventListener(SYNEXUS_PLAN_CHANGED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(SYNEXUS_PLAN_CHANGED, sync);
    };
  }, []);

  return plan;
}
