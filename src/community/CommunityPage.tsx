import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CommunityApp } from "./CommunityApp";
import { CommunityHero } from "./CommunityHero";
import { MembershipPromo } from "./components/MembershipPromo";
import {
  fetchCommunityAccess,
  type CommunityAccess,
} from "./services/communityAccess";
import "./community.css";

type AccessState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CommunityAccess };

function accessMessage(access: CommunityAccess): string {
  switch (access.reason) {
    case "authentication_required":
      return "Sign in with your SyNexus member account to continue.";
    case "membership_required":
      return "SyNexus Community is included with SyNexus Pro. Start free and join the conversation.";
    case "account_restricted":
      return "Community access is temporarily restricted. Review your moderation notices or appeal.";
    case "database_not_ready":
      return "SyNexus Community is still being prepared.";
    default:
      return "SyNexus Community is not open yet. Check back soon.";
  }
}

export function CommunityPage() {
  const [state, setState] = useState<AccessState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetchCommunityAccess(controller.signal).then(
      (access) => setState({ status: "ready", access }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Community access check is unavailable.",
        });
      },
    );
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <main className="community community--loading" aria-busy="true">
        <div className="community__skeleton community__skeleton--hero" />
        <div className="community__skeleton" />
        <div className="community__skeleton" />
      </main>
    );
  }

  if (state.status === "error" || !state.access.authorized) {
    const message =
      state.status === "error" ? state.message : accessMessage(state.access);
    const reason = state.status === "ready" ? state.access.reason : null;
    return (
      <main className="community">
        <CommunityHero>
          <p className="cx-hero__gate">{message}</p>
          {reason === "membership_required" ? (
            <MembershipPromo />
          ) : reason === "authentication_required" ? (
            <Link className="cx-cta" to="/pulse">
              Sign in to enter <span aria-hidden>›</span>
            </Link>
          ) : (
            <Link className="cx-cta cx-cta--ghost" to="/">
              Return to SyNexus
            </Link>
          )}
          <p className="cx-hero__join">Join the next phase of the network.</p>
        </CommunityHero>
      </main>
    );
  }

  return <CommunityApp owner={state.access.owner} />;
}
