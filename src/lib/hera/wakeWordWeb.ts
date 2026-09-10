import { matchWakePhrase } from "./wakeWord";

type SpeechRecognitionCtor = new () => WakeSpeechRecognition;

type WakeSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  grammars?: unknown;
  onresult: ((event: WakeSpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onnomatch?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type WakeSpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean; length: number }>;
};

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function getGrammarListCtor(): (new () => { addFromString: (src: string, weight?: number) => void }) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechGrammarList?: new () => { addFromString: (src: string, weight?: number) => void };
    webkitSpeechGrammarList?: new () => { addFromString: (src: string, weight?: number) => void };
  };
  return w.SpeechGrammarList ?? w.webkitSpeechGrammarList ?? null;
}

export function isWebWakeWordSupported(): boolean {
  return Boolean(getCtor());
}

export type WebWakeWordHandle = {
  stop: () => void;
};

function transcriptsFromEvent(event: WakeSpeechRecognitionResultEvent): string[] {
  const out: string[] = [];
  for (let i = 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    if (!result) continue;
    for (let a = 0; a < result.length; a += 1) {
      const piece = result[a]?.transcript?.trim();
      if (piece) out.push(piece);
    }
  }
  return out;
}

function heraListenLog(event: string, detail?: unknown): void {
  if (detail !== undefined) console.info(`[Hera listen] ${event}`, detail);
  else console.info(`[Hera listen] ${event}`);
}

/**
 * Foreground-only wake-word loop using the browser speech engine.
 * Transcripts are scanned locally for “hera” / “titan” and are never sent to SyNexus.
 */
export function startWebWakeWord(opts: {
  onWake: (remainder: string) => void;
  onError?: (message: string) => void;
}): WebWakeWordHandle {
  const Ctor = getCtor();
  if (!Ctor) {
    opts.onError?.("Wake-word listening is not available in this browser.");
    return { stop: () => undefined };
  }

  let stopped = false;
  let recognition: WakeSpeechRecognition | null = null;
  let restartTimer = 0;
  let armed = true;

  const restart = (delay = 180) => {
    if (stopped || !armed) return;
    window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(() => {
      if (stopped || !armed) return;
      heraListenLog("recognition restarted");
      begin();
    }, delay);
  };

  const begin = () => {
    if (stopped || !armed) return;
    try {
      recognition?.abort();
    } catch {
      /* ignore */
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 5;
    rec.lang = "en-US";
    const GrammarList = getGrammarListCtor();
    if (GrammarList) {
      try {
        const list = new GrammarList();
        list.addFromString(
          "#JSGF V1.0; grammar wake; public <wake> = hera | titan | hey hera | hey titan | hi hera | hi titan;",
          1,
        );
        rec.grammars = list;
      } catch {
        /* grammar is optional */
      }
    }
    rec.onresult = (event) => {
      if (!armed) return;
      for (const text of transcriptsFromEvent(event)) {
        if (text) heraListenLog("transcript received", text);
        const match = matchWakePhrase(text);
        if (!match.hit) continue;
        armed = false;
        heraListenLog("transcript received", { wake: true, remainder: match.remainder });
        opts.onWake(match.remainder);
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
        return;
      }
    };
    rec.onerror = (event) => {
      const code = event.error ?? "";
      heraListenLog("recognition error", { error: code });
      if (code === "no-speech" || code === "aborted" || code === "nomatch" || code === "audio-capture") return;
      if (code === "not-allowed" || code === "service-not-allowed") {
        opts.onError?.("Microphone permission is needed to listen for Hera.");
        stopped = true;
        return;
      }
    };
    rec.onnomatch = () => {
      heraListenLog("recognition error", { error: "nomatch" });
    };
    rec.onend = () => {
      heraListenLog("recognition ended");
      if (!stopped && armed) restart();
    };
    recognition = rec;
    try {
      rec.start();
      heraListenLog("microphone started");
    } catch {
      restart(320);
    }
  };

  begin();

  return {
    stop: () => {
      stopped = true;
      armed = false;
      window.clearTimeout(restartTimer);
      try {
        recognition?.abort();
      } catch {
        /* ignore */
      }
      recognition = null;
    },
  };
}
