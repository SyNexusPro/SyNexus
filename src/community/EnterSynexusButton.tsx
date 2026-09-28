import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMMUNITY_ENTRY_LABEL,
  COMMUNITY_PATH,
  isCommunityEnabled,
} from "../config/community";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { fetchCommunityAccess } from "./services/communityAccess";
import "./enterSynexusButton.css";

/**
 * Shown only to signed-in, second-factor-verified members whose plan the server
 * reports as PRO (or owner). Visibility is cosmetic: /community re-checks
 * membership server-side and the database enforces RLS.
 */
export function EnterSynexusButton() {
  const { userId, ready, secondFactorPath } = useOperatorAuth();
  const hasMemberAccount = Boolean(userId && !userId.startsWith("demo-"));
  const eligibleSession = isCommunityEnabled() && ready && hasMemberAccount && !secondFactorPath;
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!eligibleSession) {
      setIsMember(false);
      return;
    }
    const controller = new AbortController();
    void fetchCommunityAccess(controller.signal).then(
      (access) => {
        setIsMember(
          access.userId !== null &&
            access.reason !== "account_restricted" &&
            (access.plan === "PRO" || access.owner),
        );
      },
      () => {
        if (!controller.signal.aborted) setIsMember(false);
      },
    );
    return () => controller.abort();
  }, [eligibleSession, userId]);

  if (!eligibleSession || !isMember) return null;

  return (
    <Link
      className="enter-synexus"
      to={COMMUNITY_PATH}
      aria-label="Enter the members-only SyNexus Community"
    >
      <span>{COMMUNITY_ENTRY_LABEL}</span>
      <small>Members-only crypto social network</small>
    </Link>
  );
}
