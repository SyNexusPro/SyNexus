import { Link } from "react-router-dom";
import { isGiveawayActive } from "../config/giveaway";

export function GiveawayBanner() {
  if (!isGiveawayActive()) return null;

  return (
    <section className="giveaway-banner" role="region" aria-label="Launch giveaway">
      <div className="giveaway-banner__glow" aria-hidden />
      <div className="giveaway-banner__text">
        <p className="giveaway-banner__eyebrow">Launch giveaway · $700+ in prizes</p>
        <p className="giveaway-banner__headline">
          Win an <strong>iPad</strong>, <strong>AirPods Pro</strong>, or <strong>$50 Visa</strong> cards
        </p>
        <p className="giveaway-banner__detail">
          Create a free account, verify your email, and complete your profile to enter. Bonus entries for invites,
          shares, and daily logins.
        </p>
      </div>
      <Link className="giveaway-banner__cta" to="/giveaway">
        Enter giveaway
      </Link>
    </section>
  );
}
