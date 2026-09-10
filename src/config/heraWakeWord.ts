/** Wake word that opens Hera. Spoken phrase only — not a tap target. */
export const HERA_WAKE_PHRASE = "hera";

/** Extra names that still open Hera (testers who say “Titan”). */
export const HERA_WAKE_ALIASES = ["titan"] as const;

export const HERA_WAKE_ENABLED_KEY = "synexus_hera_wake_enabled";
export const HERA_WAKE_CONSENT_KEY = "synexus_hera_wake_consent";
export const HERA_WAKE_CHANGED_EVENT = "synexus-hera-wake-changed";
export const HERA_WAKE_CONSENT_EVENT = "synexus-hera-wake-consent";
/** After first Listen tap, the bottom-nav tab is removed and the toggle lives in Pulse settings. */
export const HERA_LISTEN_DOCKED_KEY = "synexus_hera_listen_docked";

export const HERA_WAKE_CONSENT_COPY = {
  title: "Listen for “Hera”",
  body:
    "While SyNexus is open, this device can listen for “Hera” (or “Titan”). Wake-word audio stays on the device and is not uploaded to SyNexus. After she hears her name, Hera opens and starts listening automatically. Background listening is off. You can turn Listen off anytime.",
  confirm: "Enable Listen",
  cancel: "Not now",
} as const;
