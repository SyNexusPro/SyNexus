import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ALL_LANGUAGE_CODES,
  getReplyLanguage,
  languageDisplayName,
  nativeLanguageName,
  setAppLanguage,
  type AppLanguageCode,
  LOCALE_STORAGE_KEY,
} from "../i18n";
import { UI_PACK_CODES } from "../i18n/catalogs";

type Props = {
  compact?: boolean;
};

export function LanguagePicker({ compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stored, setStored] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setStored(localStorage.getItem(LOCALE_STORAGE_KEY));
      } catch {
        setStored(null);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const current = stored && stored !== "auto" ? stored : getReplyLanguage();
  const label = stored === null || stored === "auto" ? t("lang.auto") : nativeLanguageName(current);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_LANGUAGE_CODES.filter((code) => {
      if (!q) return true;
      const native = nativeLanguageName(code).toLowerCase();
      const enName = languageDisplayName(code, "en").toLowerCase();
      return code.toLowerCase().includes(q) || native.includes(q) || enName.includes(q);
    });
  }, [query]);

  function pick(code: AppLanguageCode) {
    setAppLanguage(code);
    setStored(code === "auto" ? null : code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={`lang-picker${compact ? " lang-picker--compact" : ""}`}>
      <button
        type="button"
        className="lang-picker__trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-picker__label">{t("footer.language")}</span>
        <span className="lang-picker__value">{label}</span>
      </button>

      {open ? (
        <div className="lang-picker__panel" role="listbox" aria-label={t("lang.label")}>
          <input
            className="lang-picker__search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("lang.search")}
            autoFocus
          />
          <button
            type="button"
            className="lang-picker__option"
            role="option"
            aria-selected={!stored || stored === "auto"}
            onClick={() => pick("auto")}
          >
            {t("lang.auto")}
          </button>
          <ul className="lang-picker__list">
            {options.map((code) => {
              const hasUi = UI_PACK_CODES.includes(code);
              return (
                <li key={code}>
                  <button
                    type="button"
                    className="lang-picker__option"
                    role="option"
                    aria-selected={current === code && stored !== null && stored !== "auto"}
                    onClick={() => pick(code)}
                  >
                    <span>{nativeLanguageName(code)}</span>
                    <span className="lang-picker__meta">
                      {languageDisplayName(code, "en")}
                      {hasUi ? "" : " · Titan"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="lang-picker__hint">
            UI packs for major languages · Titan answers in every selected language ({i18n.language})
          </p>
        </div>
      ) : null}
    </div>
  );
}
