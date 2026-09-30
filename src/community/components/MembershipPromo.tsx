import { Link } from "react-router-dom";

/**
 * Shown only when community access is denied for lack of membership.
 * Paying Pro members never reach this state, so the offer stays off their feed.
 */
export function MembershipPromo() {
  return (
    <Link className="cx-promo" to="/pricing">
      <span className="cx-promo__badge">30 DAYS FREE</span>
      <span className="cx-promo__copy">Unlock the full Synexus Pro experience.</span>
      <span className="cx-promo__cta">Start Free Access</span>
    </Link>
  );
}
