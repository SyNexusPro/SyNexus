import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createOracleSupremeSpeaker, isOracleSupremeVoiceSupported } from "../lib/oracleSupremeVoice";
import { markIntroWelcomeSpoken, wasIntroWelcomeSpoken } from "../lib/oracleSupremeConversation";
import { notifySynexusBootComplete } from "../lib/synexusBootComplete";
const PHASE_COPY: readonly string[] = [
  "SYNEXUS INITIALIZING",
  "WELCOME TO THE SYNEXUS",
  "DEPLOYING SENTINELS",
  "MARKET FEED LIVE — NOTHING MOVES UNSEEN",
  "ENTER THE SYNEXUS",
] as const;

const SENTINELS = [
  { name: "Sentinel Aegis", role: "Hunts scams and rug pulls." },
  { name: "Sentinel Pulse", role: "Reads momentum as it breaks." },
  { name: "Sentinel Titan", role: "Shadows the whale wallets." },
  { name: "Sentinel Cipher", role: "Decodes patterns with AI." },
] as const;

/**
 * Phase gaps (ms): 0→1, 1→2, 2→3, 3→4, hold on finale, exit animation before unmount.
 * Totals ≈ 6.4s active + 0.7s fade (reduced motion: ~1.2s).
 */
function getBootDurations(reduced: boolean): readonly number[] {
  return reduced
    ? ([140, 140, 140, 140, 200, 320] as const)
    : ([600, 950, 2500, 950, 1350, 700] as const);
}

type Props = {
  children: ReactNode;
};

export function SynexusBootSequence({ children }: Props) {
  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [typedCount, setTypedCount] = useState(0);
  const spokeWelcomeRef = useRef(false);
  const speakerRef = useRef<ReturnType<typeof createOracleSupremeSpeaker> | null>(null);

  const skip = () => {
    if (exiting || removed) return;
    speakerRef.current?.stop();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setExiting(true);
    timersRef.current.push(
      setTimeout(() => {
        setRemoved(true);
        notifySynexusBootComplete();
      }, 450),
    );
  };

  useEffect(() => {
    if (removed) return;

    const steps = [...getBootDurations(reducedMotion)];

    const clearAll = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    clearAll();

    let acc = 0;
    for (let p = 1; p <= 4; p += 1) {
      acc += steps[p - 1]!;
      const next = p;
      timersRef.current.push(setTimeout(() => setPhase(next), acc));
    }

    acc += steps[4]!;
    timersRef.current.push(
      setTimeout(() => {
        setExiting(true);
      }, acc),
    );

    acc += steps[5]!;
    timersRef.current.push(
      setTimeout(() => {
        setRemoved(true);
        notifySynexusBootComplete();
        clearAll();
      }, acc),
    );

    return clearAll;
  }, [removed, reducedMotion]);

  // Typewriter reveal for the status lines (phases 0-3); the finale slams in whole.
  useEffect(() => {
    if (removed || exiting) return;
    const text = PHASE_COPY[phase] ?? "";
    if (reducedMotion || phase === 4) {
      setTypedCount(text.length);
      return;
    }
    setTypedCount(0);
    const interval = setInterval(() => {
      setTypedCount((n) => {
        if (n >= text.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 22);
    return () => clearInterval(interval);
  }, [phase, reducedMotion, removed, exiting]);

  useEffect(() => {
    if (removed || exiting || phase !== 1 || spokeWelcomeRef.current || wasIntroWelcomeSpoken()) return;
    spokeWelcomeRef.current = true;
    if (!isOracleSupremeVoiceSupported()) {
      markIntroWelcomeSpoken();
      return;
    }
    speakerRef.current = createOracleSupremeSpeaker({});
    markIntroWelcomeSpoken();
    speakerRef.current.speak("Welcome to the Synexus.");
    return () => speakerRef.current?.stop();
  }, [phase, removed, exiting]);

  useEffect(() => {
    if (!removed) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    document.body.style.overflow = "";
    return undefined;
  }, [removed]);

  const title = PHASE_COPY[phase] ?? PHASE_COPY[0];
  const typing = phase < 4 && !reducedMotion;
  const visibleTitle = typing ? title.slice(0, typedCount) : title;
  const showSentinels = phase === 2 && !exiting;

  return (
    <>
      {children}
      {!removed ? (
        <div
          className={`synexus-boot${exiting ? " synexus-boot--exit" : ""}`}
          data-phase={phase}
          aria-busy={!removed}
          onClick={skip}
        >
          <div className="synexus-boot__bg" />
          <div className="synexus-boot__flash" aria-hidden />
          <div className="synexus-boot__grid" />
          <div className="synexus-boot__honeycomb" aria-hidden />
          <div className="synexus-boot__scan synexus-boot__scan--vertical" aria-hidden />
          <div className="synexus-boot__scan synexus-boot__scan--horizontal" aria-hidden />
          <div className="synexus-boot__vignette" aria-hidden />

          <div className="synexus-boot__particles" aria-hidden>
            {PARTICLE_SEEDS.map((seed) => (
              <span key={seed.i} className="synexus-boot__particle" style={seed.style} />
            ))}
          </div>

          <div className="synexus-boot__frame synexus-boot__frame--tl" aria-hidden />
          <div className="synexus-boot__frame synexus-boot__frame--br" aria-hidden />

          <div className="synexus-boot__center">
            <p className="synexus-boot__eyebrow">THE SYNEXUS</p>

            <div className="synexus-boot__title-wrap">
              <div className="synexus-boot__title-block" key={phase}>
                <h1 className="synexus-boot__title" aria-live="polite" aria-label={title}>
                  <span aria-hidden>{visibleTitle}</span>
                  {typing ? <span className="synexus-boot__caret" aria-hidden /> : null}
                </h1>
              </div>
              <div className="synexus-boot__title-glow" aria-hidden />
            </div>

            <div
              className={`synexus-boot__sentinels${showSentinels ? " synexus-boot__sentinels--visible" : ""}`}
              aria-hidden={!showSentinels}
            >
              <ul className="synexus-boot__sentinel-list">
                {SENTINELS.map((s, i) => (
                  <li key={s.name} className="synexus-boot__sentinel" style={{ animationDelay: `${i * 0.28}s` }}>
                    <span className="synexus-boot__sentinel-name">{s.name}</span>
                    <span className="synexus-boot__sentinel-role">{s.role}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="synexus-boot__pulse-ring" aria-hidden />
            <div className="synexus-boot__ring-burst" aria-hidden />
          </div>

          <p className="synexus-boot__skip-hint">TAP TO SKIP</p>
        </div>
      ) : null}
    </>
  );
}

/** Fixed pseudo-random particle positions (no Math.random per render). */
const PARTICLE_SEEDS: { i: number; style: CSSProperties }[] = [
  { i: 0, style: { left: "8%", top: "18%", ["--synexus-d" as string]: "2.8s" } },
  { i: 1, style: { left: "22%", top: "72%", ["--synexus-d" as string]: "3.2s" } },
  { i: 2, style: { left: "78%", top: "14%", ["--synexus-d" as string]: "2.5s" } },
  { i: 3, style: { opacity: 0.85, left: "88%", top: "48%", ["--synexus-d" as string]: "3.6s" } },
  { i: 4, style: { left: "45%", top: "8%", ["--synexus-d" as string]: "2.9s" } },
  { i: 5, style: { left: "62%", top: "82%", ["--synexus-d" as string]: "3.1s" } },
  { i: 6, style: { left: "15%", top: "44%", ["--synexus-d" as string]: "3.4s" } },
  { i: 7, style: { left: "92%", top: "28%", ["--synexus-d" as string]: "2.7s" } },
];
