import { Link } from "react-router-dom";
import {
  COMMUNITY_ENTRY_LABEL,
  COMMUNITY_PATH,
  isCommunityEnabled,
} from "../config/community";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import "./enterSynexusButton.css";

/**
 * Community entry is intentionally unavailable before account creation/sign-in.
 * The destination still performs its authoritative server entitlement check.
 */
export function EnterSynexusButton() {
  const { userId, ready, secondFactorPath } = useOperatorAuth();
  const hasMemberAccount = Boolean(userId && !userId.startsWith("demo-"));

  if (
    !isCommunityEnabled() ||
    !ready ||
    !hasMemberAccount ||
    secondFactorPath
  ) {
    return null;
  }

  return (
    <Link
      className="enter-synexus"
      to={COMMUNITY_PATH}
      aria-label="Enter the members-only SyNexus Community"
    >
      <span>{COMMUNITY_ENTRY_LABEL}</span>
      <small>Members-only community</small>
    </Link>
  );
}
