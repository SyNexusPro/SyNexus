import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { catalogs } from "./catalogs";
import { en, type MessageKey } from "./en";

export const LOCALE_STORAGE_KEY = "synexus_locale";

const RTL = new Set(["ar", "he", "fa", "ur"]);

/** Broad language list for the picker — Titan replies in any of these; UI packs cover majors. */
export const ALL_LANGUAGE_CODES = [
  "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de", "el", "en",
  "es", "et", "eu", "fa", "fi", "fil", "fr", "ga", "gl", "gu", "ha", "he", "hi", "hr", "hu",
  "hy", "id", "ig", "is", "it", "ja", "jv", "ka", "kk", "km", "kn", "ko", "ku", "ky", "lo",
  "lt", "lv", "mk", "ml", "mn", "mr", "ms", "my", "ne", "nl", "no", "pa", "pl", "ps", "pt",
  "ro", "ru", "sd", "si", "sk", "sl", "so", "sq", "sr", "sv", "sw", "ta", "te", "th", "tk",
  "tr", "uk", "ur", "uz", "vi", "xh", "yo", "zh-CN", "zh-TW", "zu",
] as const;

export type AppLanguageCode = (typeof ALL_LANGUAGE_CODES)[number] | "auto";

const resources = Object.fromEntries(
  Object.entries(catalogs).map(([lng, dict]) => [lng, { translation: dict }]),
);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: [...ALL_LANGUAGE_CODES],
    nonExplicitSupportedLngs: true,
    load: "currentOnly",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      // We persist synexus_locale ourselves so reply-language can differ from UI pack.
      caches: [],
    },
    returnNull: false,
  });

export function isRtlLanguage(code: string): boolean {
  const base = code.toLowerCase().split("-")[0] ?? code;
  return RTL.has(base);
}

export function applyDocumentLocale(lng: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng;
  document.documentElement.dir = isRtlLanguage(lng) ? "rtl" : "ltr";
}

i18n.on("languageChanged", (lng) => {
  applyDocumentLocale(lng);
});

if (typeof document !== "undefined") {
  applyDocumentLocale(i18n.language || "en");
}

/** BCP-47 / English labels for the picker. */
export function languageDisplayName(code: string, inLocale = "en"): string {
  try {
    const dn = new Intl.DisplayNames([inLocale], { type: "language" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

export function nativeLanguageName(code: string): string {
  return languageDisplayName(code, code);
}

/** Resolved language for Titan replies (never "auto"). */
export function getReplyLanguage(): string {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
  if (stored && stored !== "auto") return stored;
  return i18n.resolvedLanguage || i18n.language || "en";
}

export function setAppLanguage(code: AppLanguageCode) {
  if (code === "auto") {
    try {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const nav = typeof navigator !== "undefined" ? navigator.language : "en";
    const ui = catalogs[nav] ? nav : catalogs[nav.split("-")[0] ?? ""] ? (nav.split("-")[0] as string) : "en";
    void i18n.changeLanguage(ui);
    applyDocumentLocale(nav);
    return;
  }
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  const base = code.split("-")[0] ?? code;
  const uiLng = catalogs[code] ? code : catalogs[base] ? base : "en";
  void i18n.changeLanguage(uiLng);
  applyDocumentLocale(code);
}

export type { MessageKey };
export { en, i18n };
export default i18n;
