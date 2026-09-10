import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, SUPPORT_EMAIL } from "../config/site";
import { getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";

const EFFECTIVE_LABEL = `Effective date: ${LEGAL_EFFECTIVE_DATE}`;
const DELETION_WINDOW = "30 days";

type DataCategoryId =
  | "watchlists"
  | "profile_extras"
  | "local_device"
  | "support_history"
  | "analytics_ids"
  | "all_personal_keep_account";

const DATA_CATEGORIES: { id: DataCategoryId; label: string; detail: string }[] = [
  {
    id: "watchlists",
    label: "Watchlists & tracked tokens",
    detail: "Saved lists and tokens tied to your Operator account.",
  },
  {
    id: "profile_extras",
    label: "Optional profile fields",
    detail: "Display name, bio, and similar profile extras (login email kept).",
  },
  {
    id: "local_device",
    label: "Local device data",
    detail: "Preferences, cached plan flags, and conversation history stored in this browser/app.",
  },
  {
    id: "support_history",
    label: "Support & bug reports",
    detail: "Tickets and bug reports we can reasonably link to your email.",
  },
  {
    id: "analytics_ids",
    label: "Analytics identifiers (where feasible)",
    detail: "App analytics IDs associated with your use, when we can locate and clear them.",
  },
  {
    id: "all_personal_keep_account",
    label: "All personal data we hold — keep my account",
    detail: "Delete personal data we control while preserving your login so you can keep using SyNexus.",
  },
];

function clearLocalSyNexusData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && /^synexus_/i.test(key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function DataDeletion() {
  const { t } = useTranslation();
  const [accountEmail, setAccountEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<DataCategoryId>>(new Set());
  const [details, setDetails] = useState("");
  const [clearLocalNow, setClearLocalNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    void getCurrentUser().then((user) => {
      const email = user?.email?.trim() || null;
      setSignedInEmail(email);
      if (email) setAccountEmail(email);
    });
  }, []);

  function toggleCategory(id: DataCategoryId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (id === "all_personal_keep_account") {
        if (next.has(id)) next.delete(id);
        else return new Set<DataCategoryId>(["all_personal_keep_account"]);
        return next;
      }
      next.delete("all_personal_keep_account");
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onClearLocalOnly() {
    clearLocalSyNexusData();
    setNote({
      tone: "success",
      text: "Local SyNexus data on this device was cleared. Your account was not deleted.",
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const email = accountEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNote({ tone: "error", text: "Enter the email for the SyNexus account this request applies to." });
      return;
    }
    if (selected.size === 0) {
      setNote({ tone: "error", text: "Select at least one data category to delete." });
      return;
    }

    setBusy(true);
    setNote(null);

    const chosen = DATA_CATEGORIES.filter((c) => selected.has(c.id)).map((c) => `- ${c.label}`);
    const subject = "SyNexus data deletion request (keep account)";
    const body = [
      "Please delete the following data associated with my SyNexus Operator account.",
      "Do NOT delete my account or login — I want to keep using SyNexus.",
      "",
      `Account email: ${email}`,
      `Requested at: ${new Date().toISOString()}`,
      `Page: ${typeof window !== "undefined" ? window.location.href : "/data-deletion"}`,
      "",
      "Categories requested:",
      ...chosen,
      "",
      details.trim() ? `Additional details:\n${details.trim()}` : "Additional details: (none)",
      "",
      "I understand processing may take up to 30 days after you verify this request.",
    ].join("\n");

    try {
      if (typeof window !== "undefined") {
        window.location.href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      if (clearLocalNow || selected.has("local_device") || selected.has("all_personal_keep_account")) {
        clearLocalSyNexusData();
      }
      setNote({
        tone: "success",
        text: `Data-deletion request drafted to ${SUPPORT_EMAIL}. Send the email to complete your request. Your account was not deleted.`,
      });
    } catch {
      setNote({
        tone: "error",
        text: `Could not open your email app. Email ${SUPPORT_EMAIL} with subject “Data deletion (keep account)” and list what to remove.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">{t("dataDeletion.title")}</h1>
      <p className="legal-page__summary">
        Ask {OPERATOR_LABEL} to delete some or all personal data we hold for you — without closing your SyNexus
        Operator account. To remove the account itself, use{" "}
        <Link to="/account-deletion">account deletion</Link> instead.
      </p>

      <section className="legal-section marketing-panel">
        <h2>Clear this device now</h2>
        <p>
          Removes SyNexus preferences and cached data stored in this browser or app. Does not delete your
          cloud account or server-side watchlists.
        </p>
        <button type="button" className="contact-page__submit" onClick={onClearLocalOnly}>
          {t("dataDeletion.clearLocal")}
        </button>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Request server-side / account-linked deletion</h2>
        <ol>
          <li>Enter the email on your Operator account.</li>
          <li>Select the categories you want deleted.</li>
          <li>
            Submit — your email app opens a message to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Send it to complete the request.
          </li>
        </ol>
        {signedInEmail ? (
          <p>
            Signed in as <strong>{signedInEmail}</strong>. You stay signed in after this request.
          </p>
        ) : null}

        <form className="contact-page__form" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
          <label className="contact-page__label" htmlFor="data-delete-email">
            Account email
          </label>
          <input
            id="data-delete-email"
            className="contact-page__input"
            type="email"
            autoComplete="email"
            required
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <fieldset style={{ border: "none", padding: 0, margin: "1.25rem 0 0" }}>
            <legend className="contact-page__label">What should we delete?</legend>
            <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
              {DATA_CATEGORIES.map((cat) => (
                <li key={cat.id} style={{ marginBottom: "0.75rem" }}>
                  <label
                    htmlFor={`data-cat-${cat.id}`}
                    style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}
                  >
                    <input
                      id={`data-cat-${cat.id}`}
                      type="checkbox"
                      checked={selected.has(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      style={{ marginTop: "0.2rem" }}
                    />
                    <span>
                      <strong>{cat.label}</strong>
                      <br />
                      <span style={{ opacity: 0.85 }}>{cat.detail}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <label className="contact-page__label" htmlFor="data-delete-details" style={{ marginTop: "1rem" }}>
            Additional details (optional)
          </label>
          <textarea
            id="data-delete-details"
            className="contact-page__textarea"
            rows={4}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. only delete watchlist “memes”, or remove bio but keep display name…"
          />

          <label
            className="contact-page__label"
            htmlFor="data-delete-clear-local"
            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "1rem" }}
          >
            <input
              id="data-delete-clear-local"
              type="checkbox"
              checked={clearLocalNow}
              onChange={(e) => setClearLocalNow(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>Also clear local SyNexus data on this device when I submit</span>
          </label>

          <button className="contact-page__submit" type="submit" disabled={busy} style={{ marginTop: "1rem" }}>
            {busy ? t("common.loading") : t("dataDeletion.submit")}
          </button>
        </form>

        {note ? (
          <p
            className={
              note.tone === "error"
                ? "contact-page__note contact-page__note--error"
                : "contact-page__note contact-page__note--success"
            }
            role="status"
            style={{ marginTop: "1rem" }}
          >
            {note.text}
          </p>
        ) : null}
      </section>

      <section className="legal-section marketing-panel">
        <h2>What stays if you keep your account</h2>
        <ul>
          <li>Login credentials / auth identity (unless you use full account deletion)</li>
          <li>Active subscription status needed to deliver SyNexusPro, if applicable</li>
          <li>
            Billing records held by payment processors for legal retention — see our{" "}
            <Link to="/refund-policy">Refund Policy</Link>
          </li>
          <li>Records we must keep for security, fraud prevention, or law</li>
        </ul>
        <p>
          We aim to complete verified requests within <strong>{DELETION_WINDOW}</strong>.
        </p>
      </section>

      <p className="legal-page__back">
        <Link to="/account-deletion">{t("dataDeletion.accountLink")}</Link>
        {" · "}
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
        {" · "}
        <Link to="/">← Back to feed</Link>
      </p>
    </div>
  );
}
