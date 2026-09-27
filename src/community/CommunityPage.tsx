import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCommunityAccess,
  type CommunityAccess,
} from "./services/communityAccess";
import "./community.css";

type AccessState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CommunityAccess };

const tabs = ["Home", "Explore", "Communities", "Create", "Notifications", "Profile"];

function accessMessage(access: CommunityAccess): string {
  switch (access.reason) {
    case "authentication_required":
      return "Sign in with your SyNexus member account to continue.";
    case "membership_required":
      return "SyNexus Community is available to active SyNexus Pro members.";
    case "account_restricted":
      return "Community access is temporarily restricted. Review your moderation notices or appeal.";
    case "database_not_ready":
      return "SyNexus Community is still being prepared.";
    default:
      return "SyNexus Community is not open yet.";
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
    return (
      <main className="community community--gate">
        <p className="community__eyebrow">SyNexus Sentinel protected</p>
        <h1>SyNexus Community</h1>
        <p>{message}</p>
        <Link className="community__return" to="/pulse">
          Return to SyNexus
        </Link>
      </main>
    );
  }

  return (
    <main className="community">
      <header className="community__header">
        <div>
          <p className="community__eyebrow">Members only · Sentinel protected</p>
          <h1>SyNexus Community</h1>
        </div>
        <span className="community__status">Private beta</span>
      </header>

      <nav className="community__tabs" aria-label="Community">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={index === 0 ? "is-active" : undefined}
            disabled={index !== 0}
          >
            {tab}
          </button>
        ))}
      </nav>

      <section className="community__empty">
        <span className="community__sentinel" aria-hidden>
          ◈
        </span>
        <h2>Community foundation online</h2>
        <p>
          The secure member feed is being assembled behind the feature flag.
          No content is public during this phase.
        </p>
      </section>
    </main>
  );
}
