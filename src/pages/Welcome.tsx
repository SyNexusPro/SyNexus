import { Link } from "react-router-dom";

/** Post-checkout landing page (Paddle successUrl). */
export function Welcome() {
  return (
    <div className="page">
      <section className="page__intro">
        <h1 className="page__headline">You&apos;re in</h1>
        <p className="page__lede">
          Thanks for subscribing. Membership updates as soon as Paddle confirms the payment — usually within a few
          seconds.
        </p>
      </section>
      <section className="marketing-panel">
        <p>
          <Link to="/pulse">Open Pulse</Link>
          {" · "}
          <Link to="/pricing">Manage plans</Link>
          {" · "}
          <Link to="/">Home</Link>
        </p>
      </section>
    </div>
  );
}
