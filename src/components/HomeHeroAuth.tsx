import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBiometricLogin } from "../hooks/useBiometricLogin";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useTitanBotName } from "../hooks/useTitanBotName";
import { ORACLE_OPEN_LOGIN_EVENT } from "../lib/openOracleLogin";
import { attemptBiometricQuickSignIn } from "../lib/quickOperatorSignIn";
import { syncProTrialForUser } from "../lib/proDemo";
import { QuickOperatorLogin, type QuickOperatorAuthResult } from "./QuickOperatorLogin";
import { SynexusSubscribeButton } from "./SynexusSubscribeButton";

type AuthPanel = null | "signup" | "signin";

type Props = {
  isSimple?: boolean;
};

function scrollAuthPanelIntoView() {
  requestAnimationFrame(() => {
    document.getElementById("home-auth-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

export function HomeHeroAuth({ isSimple = false }: Props) {
  const navigate = useNavigate();
  const { linked } = useOperatorAuth();
  const biometric = useBiometricLogin();
  const { name: titanName } = useTitanBotName();
  const [panel, setPanel] = useState<AuthPanel>(null);
  const [enterBusy, setEnterBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    function onOpenLogin() {
      if (linked) return;
      setPanel("signin");
      scrollAuthPanelIntoView();
    }
    window.addEventListener(ORACLE_OPEN_LOGIN_EVENT, onOpenLogin);
    return () => window.removeEventListener(ORACLE_OPEN_LOGIN_EVENT, onOpenLogin);
  }, [linked]);

  function openSignup() {
    setHint(null);
    setPanel("signup");
    scrollAuthPanelIntoView();
  }

  function closePanel() {
    setPanel(null);
    setHint(null);
  }

  async function handleEnterTitan() {
    if (linked) {
      navigate("/pulse");
      return;
    }

    setHint(null);
    setEnterBusy(true);
    try {
      if (biometric.enrolled) {
        setHint(`Verifying ${biometric.support?.label ?? "device"}…`);
        const result = await attemptBiometricQuickSignIn();
        if (result.ok) {
          closePanel();
          navigate("/pulse");
          return;
        }
        if (!result.needsEmailSignIn) {
          setHint(result.error);
          return;
        }
        setHint(result.error);
      }

      setPanel("signin");
      scrollAuthPanelIntoView();
    } finally {
      setEnterBusy(false);
    }
  }

  function handleAuthSuccess(result?: QuickOperatorAuthResult) {
    closePanel();
    if (result?.userId) {
      syncProTrialForUser(result.userId);
    }
    navigate("/pulse");
  }

  if (linked) {
    return (
      <div className="landing-hero__actions landing-hero__actions--linked">
        <Link to="/pulse" className="landing-hero__actions--secondary">
          Open Pulse
        </Link>
        {!isSimple ? (
          <SynexusSubscribeButton className="landing-hero__actions--pro" label="Synexus Pro" />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="landing-hero__actions">
        <button
          type="button"
          className="landing-hero__actions--demo"
          disabled={enterBusy}
          onClick={() => void handleEnterTitan()}
        >
          {enterBusy
            ? "Opening…"
            : biometric.enrolled
              ? `Enter ${titanName}`
              : `Enter ${titanName}`}
        </button>
        <button type="button" className="landing-hero__actions--secondary" onClick={openSignup}>
          Future {titanName}
        </button>
        {!isSimple ? (
          <SynexusSubscribeButton className="landing-hero__actions--pro" label="Synexus Pro" />
        ) : null}
      </div>

      {hint ? <p className="landing-hero__auth-hint">{hint}</p> : null}

      {panel ? (
        <div id="home-auth-panel" className="landing-hero__signin landing-hero__auth-panel">
          <button type="button" className="landing-hero__auth-close" onClick={closePanel} aria-label="Close">
            ×
          </button>
          <QuickOperatorLogin
            key={panel}
            compact
            initialMode={panel}
            showTabs={false}
            onSuccess={handleAuthSuccess}
          />
          {panel === "signin" && biometric.enrolled && biometric.emailHint ? (
            <p className="landing-hero__auth-device">
              Recognized device · {biometric.support?.label ?? "Biometric"} ready for{" "}
              {biometric.emailHint}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
