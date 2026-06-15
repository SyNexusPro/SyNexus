import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { FAQ_ITEMS, SUPPORT_EMAIL } from "../config/site";
import { submitBugReport } from "../lib/bugReport";

export function Contact() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await submitBugReport(
      { email, subject, details, pageUrl: window.location.href },
      SUPPORT_EMAIL,
    );
    setBusy(false);
    if (result.ok) {
      setNote({
        tone: "success",
        text:
          result.channel === "mailto"
            ? "Report saved locally. Your email app should open — send the message to complete submission."
            : "Report saved on this device. Configure VITE_SUPPORT_EMAIL for mailto handoff.",
      });
      setSubject("");
      setDetails("");
    } else {
      setNote({ tone: "error", text: result.message });
    }
  }

  return (
    <div className="page contact-page">
      <section className="contact-page__hero marketing-panel">
        <p className="contact-page__eyebrow">Contact</p>
        <h1 className="contact-page__title">Support, FAQ, and bug reports</h1>
        <p className="contact-page__lede">
          Questions about Synexus Pro, Sentinel reads, or wallet flows? Reach us below. For urgent wallet or
          seed-phrase issues, contact your wallet provider — Synexus cannot recover lost keys.
        </p>
      </section>

      <section className="contact-page__section marketing-panel">
        <h2>Support email</h2>
        <p>
          <a className="contact-page__email" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <p className="contact-page__hint">
          Include your device (web / Android), Synexus version, and steps to reproduce for faster help.
        </p>
      </section>

      <section className="contact-page__section marketing-panel">
        <h2>Frequently asked questions</h2>
        <dl className="contact-page__faq">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="contact-page__faq-item">
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="contact-page__section marketing-panel">
        <h2>Report a bug</h2>
        <p>Broken UI, wrong token data, checkout issues, or Sentinel misfires — tell us what happened.</p>
        <form className="contact-page__form" onSubmit={onSubmit}>
          <label className="contact-page__label" htmlFor="bug-email">
            Your email (optional)
          </label>
          <input
            id="bug-email"
            className="contact-page__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <label className="contact-page__label" htmlFor="bug-subject">
            Subject
          </label>
          <input
            id="bug-subject"
            className="contact-page__input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Token detail chart not loading"
            required
          />
          <label className="contact-page__label" htmlFor="bug-details">
            What happened?
          </label>
          <textarea
            id="bug-details"
            className="contact-page__textarea"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Steps to reproduce, token mint if relevant, expected vs actual behavior…"
            rows={5}
            required
          />
          <button type="submit" className="contact-page__submit" disabled={busy}>
            {busy ? "Sending…" : "Submit bug report"}
          </button>
          {note ? (
            <p
              className={`contact-page__note contact-page__note--${note.tone}`}
              role="status"
            >
              {note.text}
            </p>
          ) : null}
        </form>
        <p className="contact-page__fineprint">
          Token scam reports can also be filed from a token&apos;s detail page when signed in on{" "}
          <Link to="/pulse">Pulse</Link>.
        </p>
      </section>

      <p className="contact-page__back">
        <Link to="/about">About Synexus</Link>
        {" · "}
        <Link to="/trust">Trust &amp; safety</Link>
        {" · "}
        <Link to="/">← Feed</Link>
      </p>
    </div>
  );
}
