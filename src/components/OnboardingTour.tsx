import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getOnboardingSteps } from "../config/onboardingTour";
import { useTitanChatOpen, useTitanLoginOpen } from "../hooks/useTitanChatOpen";
import { isNativeAndroid } from "../lib/bootExperience";
import {
  isOnboardingTourRoute,
  markOnboardingTourComplete,
  wantsForcedOnboardingTour,
} from "../lib/onboardingTour";
import { isSynexusBootComplete, subscribeSynexusBootComplete } from "../lib/synexusBootComplete";

const PAD = 8;
const HOLE_RADIUS = 14;

type Hole = { top: number; left: number; width: number; height: number };

function padRect(r: DOMRect): Hole {
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function readTargetHole(id: string | null): Hole | null {
  if (!id) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return padRect(r);
}

export function OnboardingTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const heraOpen = useTitanChatOpen();
  const loginOpen = useTitanLoginOpen();
  const [bootDone, setBootDone] = useState(() => isSynexusBootComplete());
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const [listenVisible, setListenVisible] = useState(true);
  const findRef = useRef(0);

  const steps = useMemo(
    () => getOnboardingSteps({ android: isNativeAndroid(), listenVisible }),
    [listenVisible],
  );
  const step = steps[stepIndex] ?? steps[0];
  const paused = heraOpen || loginOpen;

  const startedRef = useRef(false);

  useEffect(() => {
    if (bootDone) return;
    return subscribeSynexusBootComplete(() => setBootDone(true));
  }, [bootDone]);

  useEffect(() => {
    if (!bootDone || startedRef.current) return;
    if (!isOnboardingTourRoute(location.pathname)) return;
    // Spotlight ring is opt-in only. The sign-up demo is Hera-guided.
    if (!wantsForcedOnboardingTour()) return;
    const timer = window.setTimeout(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      setListenVisible(Boolean(document.querySelector('[data-tour="nav-listen"]')));
      setActive(true);
      setStepIndex(0);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [bootDone, location.pathname]);

  const finish = useCallback(() => {
    markOnboardingTourComplete();
    if (wantsForcedOnboardingTour()) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    setActive(false);
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next >= steps.length) {
        finish();
        return;
      }
      setStepIndex(Math.max(0, next));
    },
    [finish, steps.length],
  );

  useEffect(() => {
    if (!active || !step?.route) return;
    if (location.pathname !== step.route) navigate(step.route);
  }, [active, step?.route, location.pathname, navigate]);

  useEffect(() => {
    if (!active || paused || !step) return;
    let alive = true;
    const token = ++findRef.current;

    const tick = () => {
      if (!alive || token !== findRef.current) return;
      const next = readTargetHole(step.target);
      setHole(next);
      if (step.target && !next) {
        window.setTimeout(tick, 80);
      }
    };

    const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    tick();

    const onMove = () => {
      if (!alive) return;
      setHole(readTargetHole(step.target));
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      alive = false;
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [active, paused, step]);

  if (!active || !step) return null;

  const last = stepIndex === steps.length - 1;
  const cardBottom = hole && hole.top + hole.height > window.innerHeight * 0.58;
  const cardStyle = hole
    ? cardBottom
      ? { bottom: Math.max(16, window.innerHeight - hole.top + 12) }
      : { top: Math.min(window.innerHeight - 220, hole.top + hole.height + 12) }
    : undefined;

  return (
    <div className="onboarding-tour" role="dialog" aria-modal="false" aria-labelledby="onboarding-tour-title">
      {paused ? (
        <div className="onboarding-tour__paused">
          <p>Tutorial paused — finish here, then we’ll pick back up.</p>
          <button type="button" className="onboarding-tour__skip" onClick={finish}>
            Skip tutorial
          </button>
        </div>
      ) : (
        <>
          {hole ? (
            <>
              <div className="onboarding-tour__shade" style={{ top: 0, left: 0, right: 0, height: hole.top }} />
              <div className="onboarding-tour__shade" style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }} />
              <div className="onboarding-tour__shade" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
              <div className="onboarding-tour__shade" style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
              <div
                className="onboarding-tour__ring"
                style={{
                  top: hole.top,
                  left: hole.left,
                  width: hole.width,
                  height: hole.height,
                  borderRadius: HOLE_RADIUS,
                }}
              />
            </>
          ) : (
            <div className="onboarding-tour__shade onboarding-tour__shade--full" />
          )}

          <div className={`onboarding-tour__card${hole ? "" : " onboarding-tour__card--center"}`} style={cardStyle}>
            <p className="onboarding-tour__eyebrow">
              {stepIndex + 1} / {steps.length}
            </p>
            <h2 id="onboarding-tour-title">{step.title}</h2>
            <p className="onboarding-tour__body">{step.body}</p>
            {step.interactHint ? <p className="onboarding-tour__hint">{step.interactHint}</p> : null}
            <div className="onboarding-tour__actions">
              <button type="button" className="onboarding-tour__skip" onClick={finish}>
                Skip tutorial
              </button>
              <div className="onboarding-tour__nav">
                {stepIndex > 0 ? (
                  <button type="button" className="onboarding-tour__btn" onClick={() => go(stepIndex - 1)}>
                    Back
                  </button>
                ) : null}
                <button
                  type="button"
                  className="onboarding-tour__btn onboarding-tour__btn--primary"
                  onClick={() => go(stepIndex + 1)}
                >
                  {last ? "Done" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
