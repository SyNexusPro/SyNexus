import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureGiveawayReferralFromUrl } from "../lib/giveaway";

/** Persists ?ref= from any route for giveaway referral credit on sign-up. */
export function GiveawayReferralCapture() {
  const location = useLocation();

  useEffect(() => {
    captureGiveawayReferralFromUrl(location.search);
  }, [location.search]);

  return null;
}
