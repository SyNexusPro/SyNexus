import { Link } from "react-router-dom";
import { FAQ_ITEMS, SUPPORT_EMAIL } from "../config/site";

export function Faq() {
  return (
    <div className="page contact-page">
      <section className="contact-page__hero marketing-panel">
        <p className="contact-page__eyebrow">FAQ</p>
        <h1 className="contact-page__title">Frequently asked questions</h1>
        <p className="contact-page__lede">
          Quick answers about Synexus, Pro, wallets, and risk tooling. Still stuck?{" "}
          <Link to="/contact">Contact support</Link> or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section className="contact-page__section marketing-panel">
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
        <h2>Legal &amp; policies</h2>
        <p>
          <Link to="/terms">Terms of Service</Link>
          {" · "}
          <Link to="/privacy">Privacy Policy</Link>
          {" · "}
          <Link to="/disclaimer">Disclaimer</Link>
          {" · "}
          <Link to="/trust">Trust &amp; safety</Link>
        </p>
      </section>

      <p className="contact-page__back">
        <Link to="/contact">Contact &amp; bug reports</Link>
        {" · "}
        <Link to="/">← Feed</Link>
      </p>
    </div>
  );
}
