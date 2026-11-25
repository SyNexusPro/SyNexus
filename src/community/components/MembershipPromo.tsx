import { Link } from "react-router-dom";

/**
 * Shown only when community access is denied for lack of Pantheon membership.
 * Pantheon members never reach this state, so the offer stays off their feed.
 */
export function MembershipPromo() {
  return (
    <Link className="cx-promo" to="/pricing">
      <span className="cx-promo__badge">SOCIAL · $20</span>
      <span className="cx-promo__copy">
        Community is a Pantheon perk ($20/mo). New accounts can try Next Level free for 30 days (no card) from Pricing —
        that free trial does not unlock social.
      </span>
      <span className="cx-promo__cta">See plans</span>
    </Link>
  );
}
