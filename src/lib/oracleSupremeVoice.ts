import {
  type OracleSupremeDailyReport,
  oracleSupremeMoodLabel,
} from "../data/syntheticWatchers";

const VOICE_PATTERNS = [
  /samantha/i,
  /google.*english.*female/i,
  /microsoft.*zira/i,
  /zira/i,
  /karen/i,
  /victoria/i,
  /moira/i,
  /fiona/i,
  /jenny/i,
  /aria/i,
  /google uk english female/i,
  /en-gb.*female/i,
  /en-us.*female/i,
  /english.*female/i,
  /female/i,
];

export function isOracleSupremeVoiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function pickOracleSupremeVoice(): SpeechSynthesisVoice | null {
  if (!isOracleSupremeVoiceSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  for (const pattern of VOICE_PATTERNS) {
    const match = voices.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }

  const english = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  return english ?? voices[0] ?? null;
}

function speakLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function briefingToFirstPerson(briefing: string): string {
  return briefing
    .replace(/^Oracle Supreme is online and waiting\./, "I'm online and ready.")
    .replace(/^Oracle is monitoring/, "I'm monitoring")
    .replace(/^Oracle just reviewed/, "I just reviewed")
    .replace(/Oracle is (\d+)% confident/, "I'm $1% confident")
    .replace(/Oracle's call/, "My call")
    .replace(/ — see your briefing below\.?$/, ".");
}

function reportLineToSpeech(text: string): string {
  return text
    .replace(/^Oracle /, "I ")
    .replace(/^Oracle's advice/, "My advice")
    .replace(/ Oracle /g, " I ")
    .replace(/Oracle is /g, "I'm ")
    .replace(/Oracle's /g, "My ");
}

export function buildOracleSupremeSpeakScript(
  mode: "sample" | "full",
  briefing: string,
  report?: OracleSupremeDailyReport,
): string {
  if (mode === "sample") {
    return speakLine(
      "Oracle Supreme online. I'm your synthetic commander — I learn, I decide, and I run your Sentinels. " +
        "Synexus Pro unlocks my full voice briefings: every alert and every read, delivered personally to you.",
    );
  }

  const parts: string[] = ["Oracle Supreme, reporting.", briefingToFirstPerson(briefing)];

  if (report) {
    const mood = oracleSupremeMoodLabel(report.mood).toLowerCase();
    parts.push(
      `Market stress is ${mood}. Your Sentinel team is at ${report.systemHealth} percent health, graded ${report.oversightGrade}.`,
    );
    parts.push(reportLineToSpeech(report.headline));
    parts.push(reportLineToSpeech(report.daySummary));
    parts.push("Here's what I need you to focus on.");
    report.priorities.forEach((priority, index) => {
      parts.push(`${index + 1}. ${reportLineToSpeech(priority)}`);
    });
    parts.push(reportLineToSpeech(report.closingNote));
  }

  return speakLine(parts.join(" "));
}

export type OracleSupremeSpeaker = {
  speak: (text: string) => void;
  stop: () => void;
};

export type OracleSupremeSpeakerOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  /** Slower, warmer delivery for the boot welcome line. */
  variant?: "default" | "intro";
};

function splitIntroSpeech(text: string): string[] {
  const normalized = speakLine(text);
  const match = normalized.match(/^(.+?\.\s+)(.+)$/);
  if (!match) return [normalized];
  return [match[1]!.trim(), match[2]!.trim()];
}

export function createOracleSupremeSpeaker(handlers: OracleSupremeSpeakerOptions): OracleSupremeSpeaker {
  if (!isOracleSupremeVoiceSupported()) {
    return {
      speak: () => {},
      stop: () => {
        handlers.onEnd?.();
      },
    };
  }

  const synth = window.speechSynthesis;
  const isIntro = handlers.variant === "intro";
  let introChainToken = 0;

  const stop = () => {
    introChainToken += 1;
    synth.cancel();
    handlers.onEnd?.();
  };

  const speakOne = (text: string, onComplete: () => void, fireStart?: boolean) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = isIntro ? 0.84 : 0.9;
    utterance.pitch = isIntro ? 0.97 : 1.06;
    utterance.volume = 1;

    utterance.onstart = () => {
      if (fireStart) handlers.onStart?.();
    };
    utterance.onend = () => onComplete();
    utterance.onerror = () => {
      handlers.onError?.();
      onComplete();
    };

    const launch = () => {
      const voice = pickOracleSupremeVoice();
      if (voice) utterance.voice = voice;
      synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
      const onVoices = () => {
        synth.removeEventListener("voiceschanged", onVoices);
        launch();
      };
      synth.addEventListener("voiceschanged", onVoices);
      window.setTimeout(launch, 300);
    } else {
      launch();
    }
  };

  const speak = (text: string) => {
    if (!text.trim()) return;

    synth.cancel();
    introChainToken += 1;
    const chainId = introChainToken;

    const finish = () => {
      if (chainId !== introChainToken) return;
      handlers.onEnd?.();
    };

    const parts = isIntro ? splitIntroSpeech(text) : [speakLine(text)];

    const speakPart = (index: number) => {
      if (chainId !== introChainToken) return;
      if (index >= parts.length) {
        finish();
        return;
      }
      speakOne(
        parts[index]!,
        () => {
          if (chainId !== introChainToken) return;
          if (index + 1 < parts.length) {
            window.setTimeout(() => speakPart(index + 1), isIntro ? 520 : 0);
          } else {
            finish();
          }
        },
        index === 0,
      );
    };

    speakPart(0);
  };

  return { speak, stop };
}
