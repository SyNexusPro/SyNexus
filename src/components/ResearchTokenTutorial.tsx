import { useCallback, useEffect, useRef, useState } from "react";
import {
  RESEARCH_TOKEN_TUTORIAL_STEPS,
  type ResearchTutorialVisual,
} from "../config/researchTokenTutorial";
import {
  isTutorialSpeechSupported,
  speakTutorial,
  stopTutorialSpeech,
} from "../lib/tutorialSpeech";

function TutorialVisual({ visual }: { visual: ResearchTutorialVisual }) {
  switch (visual) {
    case "welcome":
      return (
        <div className="research-tutorial__stage research-tutorial__stage--welcome">
          <div className="research-tutorial__orb" aria-hidden />
          <p className="research-tutorial__stage-title">Token research</p>
          <p className="research-tutorial__stage-sub">Should I buy this?</p>
        </div>
      );
    case "paste":
      return (
        <div className="research-tutorial__stage research-tutorial__stage--paste">
          <div className="research-tutorial__mock-input">
            <span className="research-tutorial__mock-cursor" aria-hidden />
            BONK
          </div>
          <p className="research-tutorial__stage-hint">Symbol or mint address</p>
        </div>
      );
    case "scan":
      return (
        <div className="research-tutorial__stage research-tutorial__stage--scan">
          <div className="research-tutorial__mock-radar" aria-hidden>
            <span className="research-tutorial__mock-radar-ring" />
            <span className="research-tutorial__mock-radar-sweep" />
          </div>
          <p className="research-tutorial__stage-hint">Sentinels scanning…</p>
        </div>
      );
    case "verdict":
      return (
        <div className="research-tutorial__stage research-tutorial__stage--verdict">
          <p className="research-tutorial__mock-verdict research-tutorial__mock-verdict--watch">Watch</p>
          <div className="research-tutorial__mock-bars" aria-hidden>
            <span style={{ width: "72%" }} />
            <span style={{ width: "48%" }} />
            <span style={{ width: "61%" }} />
          </div>
        </div>
      );
    case "does":
      return (
        <ul className="research-tutorial__checklist research-tutorial__checklist--yes">
          <li>Early risk warnings</li>
          <li>Plain-English verdict</li>
          <li>Shareable scan links</li>
        </ul>
      );
    case "does-not":
      return (
        <ul className="research-tutorial__checklist research-tutorial__checklist--no">
          <li>Not financial advice</li>
          <li>Never holds your keys</li>
          <li>Cannot catch every scam</li>
        </ul>
      );
    default:
      return null;
  }
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
};

function ResearchTokenTutorialModal({ open, onClose }: ModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const stepRef = useRef(0);

  const step = RESEARCH_TOKEN_TUTORIAL_STEPS[stepIndex] ?? RESEARCH_TOKEN_TUTORIAL_STEPS[0];
  const atEnd = stepIndex >= RESEARCH_TOKEN_TUTORIAL_STEPS.length - 1;

  const playStep = useCallback((index: number) => {
    const target = RESEARCH_TOKEN_TUTORIAL_STEPS[index];
    if (!target) return;

    stepRef.current = index;
    setStepIndex(index);
    setSpeaking(true);

    speakTutorial(target.narration, {
      onEnd: () => {
        setSpeaking(false);
        if (!autoPlay) return;
        const next = index + 1;
        if (next < RESEARCH_TOKEN_TUTORIAL_STEPS.length) {
          window.setTimeout(() => playStep(next), 400);
        }
      },
      onError: () => setSpeaking(false),
    });
  }, [autoPlay]);

  useEffect(() => {
    if (!open) {
      stopTutorialSpeech();
      setSpeaking(false);
      setStepIndex(0);
      stepRef.current = 0;
      return;
    }

    setAutoPlay(true);
    playStep(0);

    return () => {
      stopTutorialSpeech();
    };
  }, [open, playStep]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleReplay() {
    stopTutorialSpeech();
    setAutoPlay(true);
    playStep(0);
  }

  function handleTogglePlay() {
    if (speaking) {
      stopTutorialSpeech();
      setSpeaking(false);
      setAutoPlay(false);
      return;
    }
    setAutoPlay(false);
    playStep(stepRef.current);
  }

  function handleNext() {
    stopTutorialSpeech();
    setAutoPlay(false);
    const next = Math.min(stepIndex + 1, RESEARCH_TOKEN_TUTORIAL_STEPS.length - 1);
    playStep(next);
  }

  function handlePrev() {
    stopTutorialSpeech();
    setAutoPlay(false);
    const prev = Math.max(stepIndex - 1, 0);
    playStep(prev);
  }

  return (
    <div className="research-tutorial__backdrop" onClick={onClose} role="presentation">
      <div
        className="research-tutorial__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-tutorial-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="research-tutorial__header">
          <div>
            <p className="research-tutorial__eyebrow">Watch &amp; listen</p>
            <h2 id="research-tutorial-title">How token research works</h2>
          </div>
          <button type="button" className="research-tutorial__close" onClick={onClose} aria-label="Close tutorial">
            ×
          </button>
        </header>

        <div className="research-tutorial__video" aria-live="polite">
          <TutorialVisual visual={step.visual} />
          <p className="research-tutorial__caption">{step.caption}</p>
          <div className="research-tutorial__progress" aria-hidden>
            {RESEARCH_TOKEN_TUTORIAL_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`research-tutorial__dot${i === stepIndex ? " research-tutorial__dot--active" : i < stepIndex ? " research-tutorial__dot--done" : ""}`}
              />
            ))}
          </div>
        </div>

        <div className="research-tutorial__controls">
          <button type="button" className="research-tutorial__ctrl" onClick={handlePrev} disabled={stepIndex === 0}>
            Back
          </button>
          <button type="button" className="research-tutorial__ctrl research-tutorial__ctrl--primary" onClick={handleTogglePlay}>
            {speaking ? "Pause voice" : "Play voice"}
          </button>
          <button type="button" className="research-tutorial__ctrl" onClick={handleNext} disabled={atEnd}>
            Next
          </button>
          <button type="button" className="research-tutorial__ctrl" onClick={handleReplay}>
            Replay
          </button>
        </div>

        {!isTutorialSpeechSupported() ? (
          <p className="research-tutorial__fallback">Voice unavailable on this device — read the captions above.</p>
        ) : null}
      </div>
    </div>
  );
}

/** Small ? button — opens narrated token research tutorial. */
export function ResearchTokenTutorialButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="research-tutorial__trigger"
        onClick={() => setOpen(true)}
        aria-label="Watch and listen: how token research works"
        title="How token research works"
      >
        <span aria-hidden>?</span>
      </button>
      <ResearchTokenTutorialModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
