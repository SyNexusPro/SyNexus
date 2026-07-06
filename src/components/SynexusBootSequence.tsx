import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createOracleSupremeSpeaker, isOracleSupremeVoiceSupported } from "../lib/oracleSupremeVoice";
import { resolveTitanBotName } from "../lib/titanBotName";
import {
  buildOracleIntroVoiceLine,
  markIntroWelcomeSpoken,
  resolveIntroOperatorName,
  wasIntroWelcomeSpoken,
} from "../lib/oracleSupremeConversation";
import {
  getBootDurations,
  getBootExitMs,
  markBootIntroSeen,
  readPrefersReducedMotion,
  resolveBootProfile,
  shouldBootTypewriter,
  shouldBootVoice,
  shouldShowBootSentinels,
  type BootProfile,
} from "../lib/bootExperience";
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
  { name: "Sentinel Leviathan", role: "Shadows the whale wallets." },
  { name: "Sentinel Cipher", role: "Decodes patterns with AI." },
] as const;

type Props = {
  children: ReactNode;
};

function finishBoot(
  setRemoved: (v: boolean) => void,
  timersRef: React.MutableRefObject<ReturnType<typeof setTimeout>[]>,
  exitMs: number,
) {
  markBootIntroSeen();
  timersRef.current.push(
    setTimeout(() => {
      setRemoved(true);
      notifySynexusBootComplete();
    }, exitMs),
  );
}

export function SynexusBootSequence({ children }: Props) {
  const bootProfileRef = useRef<BootProfile>(
    typeof window !== "undefined" ? resolveBootProfile(readPrefersReducedMotion()) : "full",
  );
  const profile = bootProfileRef.current;
  const skipEntirely = profile === "skip";

  const [phase, setPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [removed, setRemoved] = useState(skipEntirely);
  const [reducedMotion] = useState(readPrefersReducedMotion);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [typedCount, setTypedCount] = useState(0);
  const spokeWelcomeRef = useRef(false);
  const speakerRef = useRef<ReturnType<typeof createOracleSupremeSpeaker> | null>(null);
  const exitMs = getBootExitMs(profile);

  useLayoutEffect(() => {
    if (skipEntirely) {
      markBootIntroSeen();
      notifySynexusBootComplete();
    }
  }, [skipEntirely]);

  const skip = () => {
    if (exiting || removed) return;
    speakerRef.current?.stop();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setExiting(true);
    finishBoot(setRemoved, timersRef, exitMs);
  };

  useEffect(() => {
    if (removed || skipEntirely) return;

    const steps = [...getBootDurations(profile)];

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
        markBootIntroSeen();
        setRemoved(true);
        notifySynexusBootComplete();
        clearAll();
      }, acc),
    );

    return clearAll;
  }, [removed, profile, skipEntirely]);

  useEffect(() => {
    if (removed || exiting || skipEntirely) return;
    const text = PHASE_COPY[phase] ?? "";
    if (!shouldBootTypewriter(profile) || phase === 4) {
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
  }, [phase, profile, removed, exiting, skipEntirely]);

  useEffect(() => {
    if (
      removed ||
      exiting ||
      skipEntirely ||
      phase !== 1 ||
      spokeWelcomeRef.current ||
      wasIntroWelcomeSpoken() ||
      !shouldBootVoice(profile)
    ) {
      return;
    }
    spokeWelcomeRef.current = true;
    if (!isOracleSupremeVoiceSupported()) {
      markIntroWelcomeSpoken();
      return;
    }
    const introLine = buildOracleIntroVoiceLine(resolveIntroOperatorName(), resolveTitanBotName());
    speakerRef.current = createOracleSupremeSpeaker({
      variant: "intro",
      onEnd: () => markIntroWelcomeSpoken(),
      onError: () => markIntroWelcomeSpoken(),
    });
    speakerRef.current.speak(introLine);
    // Do not stop voice when phase advances — only on unmount or explicit skip.
  }, [phase, profile, removed, exiting, skipEntirely]);

  useEffect(() => {
    return () => {
      speakerRef.current?.stop();
    };
  }, []);

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
  const typing = shouldBootTypewriter(profile) && phase < 4 && !reducedMotion;
  const visibleTitle = typing ? title.slice(0, typedCount) : title;
  const showSentinels = shouldShowBootSentinels(profile, phase) && !exiting;

  return (
    <>
      {children}
      {!removed ? (
        <div
          className={`synexus-boot${exiting ? " synexus-boot--exit" : ""}${profile === "fast" ? " synexus-boot--fast" : ""}`}
          data-phase={phase}
          data-boot-profile={profile}
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
                {phase === 1 ? (
                  <p className="synexus-boot__subtitle" aria-hidden>
                    {resolveTitanBotName()} · your intelligence commander
                  </p>
                ) : null}
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
  { i: 7, style: { opacity: 0.92, left: "92%", top: "28%", ["--synexus-d" as string]: "2.7s" } },
];
