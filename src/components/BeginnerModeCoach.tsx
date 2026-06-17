import { useState } from "react";
import { useSynexusUIMode } from "../hooks/useSynexusUIMode";

const DISMISS_KEY = "synexus_easy_mode_coach_dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function BeginnerModeCoach() {
  const { isSimple } = useSynexusUIMode();
  const [hidden, setHidden] = useState(() => wasDismissed());

  if (!isSimple || hidden) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  return (
    <aside className="beginner-coach" role="note">
      <div className="beginner-coach__glow" aria-hidden />
      <div className="beginner-coach__body">
        <p className="beginner-coach__eyebrow">You&apos;re in Easy mode</p>
        <p className="beginner-coach__text">
          We hide the complex stuff. Paste a token, get a plain answer, then switch to{" "}
          <strong>Advanced</strong> when you want the full Sentinel grid.
        </p>
      </div>
      <button type="button" className="beginner-coach__close" onClick={dismiss} aria-label="Dismiss">
        Got it
      </button>
    </aside>
  );
}
