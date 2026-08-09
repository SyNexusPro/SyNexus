import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LEGAL_EFFECTIVE_DATE, OPERATOR_LABEL, SUPPORT_EMAIL } from "../config/site";
import { getCurrentUser, signOut } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";

const EFFECTIVE_LABEL = `Effective date: ${LEGAL_EFFECTIVE_DATE}`;
const DELETION_WINDOW = "30 days";

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

export function AccountDeletion() {
  const [accountEmail, setAccountEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    void getCurrentUser().then((user) => {
      const email = user?.email?.trim() || null;
      setSignedInEmail(email);
      if (email) setAccountEmail(email);
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const email = accountEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNote({ tone: "error", text: "Enter the email address for the SyNexus account to delete." });
      return;
    }
    if (!confirm) {
      setNote({ tone: "error", text: "Confirm that you want this account deleted." });
      return;
    }

    setBusy(true);
    setNote(null);

    const subject = "SyNexus account deletion request";
    const body = [
      "Please delete my SyNexus Operator account and associated personal data.",
      "",
      `Account email: ${email}`,
      `Requested at: ${new Date().toISOString()}`,
      `Page: ${typeof window !== "undefined" ? window.location.href : "/account-deletion"}`,
      "",
      "I understand deletion is permanent and may take up to 30 days.",
    ].join("\n");

    try {
      if (typeof window !== "undefined") {
        window.location.href = `mailto:${encodeURIComponent(SUPPORT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }

      clearLocalSyNexusData();
      if (hasSupabaseEnv && signedInEmail) {
        try {
          await signOut();
        } catch {
          /* session may already be cleared */
        }
        setSignedInEmail(null);
      }

      setNote({
        tone: "success",
        text: `Deletion request drafted to ${SUPPORT_EMAIL}. Send the email to complete your request. Local SyNexus data on this device was cleared.`,
      });
    } catch {
      setNote({
        tone: "error",
        text: `Could not open your email app. Email ${SUPPORT_EMAIL} with subject “Account deletion” and your account email.`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page legal-page">
      <p className="legal-page__eyebrow">{EFFECTIVE_LABEL}</p>
      <h1 className="legal-page__title">Delete your SyNexus account</h1>
      <p className="legal-page__summary">
        Use this page to request deletion of your SyNexus Operator account and related personal data held by{" "}
        {OPERATOR_LABEL}. This URL is provided for Google Play and privacy compliance.
      </p>

      <section className="legal-section marketing-panel">
        <h2>How to request deletion</h2>
        <ol>
          <li>Enter the email used for your SyNexus Operator Link account.</li>
          <li>Confirm you want the account deleted.</li>
          <li>
            Submit the form — your email app opens a message to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Send it to complete the request.
          </li>
          <li>
            Or email us directly from that address with subject <strong>Account deletion</strong>.
          </li>
        </ol>
        {signedInEmail ? (
          <p>
            You are signed in as <strong>{signedInEmail}</strong>. Submitting also signs you out and clears
            local SyNexus data on this device.
          </p>
        ) : (
          <p>
            You do not need to be signed in. Requests from the email on the account help us verify ownership.
          </p>
        )}

        <form className="contact-page__form" onSubmit={onSubmit} style={{ marginTop: "1.25rem" }}>
          <label className="contact-page__label" htmlFor="delete-account-email">
            Account email
          </label>
          <input
            id="delete-account-email"
            className="contact-page__input"
            type="email"
            autoComplete="email"
            required
            value={accountEmail}
            onChange={(e) => setAccountEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label
            className="contact-page__label"
            htmlFor="delete-account-confirm"
            style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "1rem" }}
          >
            <input
              id="delete-account-confirm"
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              style={{ marginTop: "0.2rem" }}
            />
            <span>
              I want this SyNexus account and associated personal data deleted. I understand this cannot be
              undone once completed.
            </span>
          </label>

          <button className="contact-page__submit" type="submit" disabled={busy} style={{ marginTop: "1rem" }}>
            {busy ? "Preparing request…" : "Request account deletion"}
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
        <h2>What is deleted</h2>
        <p>After we verify your request, we delete or irreversibly de-identify:</p>
        <ul>
          <li>Auth account (email / login identifiers)</li>
          <li>Profile fields (username, display name, bio, plan flags on our systems)</li>
          <li>Watchlists, tracked tokens, and in-app preference data tied to your user id</li>
          <li>Support tickets and bug reports we can reasonably link to your account email</li>
        </ul>
      </section>

      <section className="legal-section marketing-panel">
        <h2>What may be retained</h2>
        <ul>
          <li>
            Billing / tax records held by payment processors (for example Square) for legal and accounting
            retention
          </li>
          <li>Aggregated analytics that cannot reasonably identify you</li>
          <li>Records we must keep for fraud prevention, security, or legal compliance</li>
          <li>
            On-chain activity is public and not controlled by SyNexus — we never hold your wallet keys or
            custody funds
          </li>
        </ul>
      </section>

      <section className="legal-section marketing-panel">
        <h2>Timeline</h2>
        <p>
          We aim to complete verified deletion requests within <strong>{DELETION_WINDOW}</strong> of receiving
          your email. You will get a confirmation when deletion is finished, or if we need more information to
          verify the request.
        </p>
        <p>
          Canceling SyNexusPro stops future charges per our{" "}
          <Link to="/refund-policy">Refund Policy</Link>; cancellation alone does not delete your account —
          use this page for deletion.
        </p>
      </section>

      <p className="legal-page__back">
        <Link to="/privacy">Privacy Policy</Link>
        {" · "}
        <Link to="/contact">Contact</Link>
        {" · "}
        <Link to="/terms">Terms</Link>
        {" · "}
        <Link to="/">← Back to feed</Link>
      </p>
    </div>
  );
}
