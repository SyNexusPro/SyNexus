/**
 * Validation and defensive scrubbing for Alexus -> Hera reports.
 * Alexus already redacts before sending; this is a second layer so a mistake on the sender never lands in storage.
 */

export const HERA_INGEST_MAX_BODY_BYTES = 3_000_000;
export const HERA_INGEST_MAX_EVENT_ROWS = 2_000;

export type AlexusReport = {
  bot: string;
  seq: number;
  reportAt: string;
  snapshot: Record<string, unknown>;
  events: Record<string, unknown[]>;
  note: string;
};

export type IngestParse =
  | { ok: true; report: AlexusReport; scrubbed: number }
  | { ok: false; reason: string };

const SECRET_KEY = /(private.?key|secret|seed|mnemonic|api.?key|apikey|authorization|password|passphrase|bearer|access.?token|refresh.?token)/i;
const MAX_DEPTH = 12;
const MAX_NODES = 200_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Replaces the value of any secret-looking key with "[redacted]". Bounded in depth and size. */
export function scrubSecrets<T>(input: T): { value: T; scrubbed: number } {
  let scrubbed = 0;
  let nodes = 0;
  const walk = (value: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > MAX_NODES || depth > MAX_DEPTH) return null;
    if (Array.isArray(value)) return value.map((item) => walk(item, depth + 1));
    if (isPlainObject(value)) {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(value)) {
        if (SECRET_KEY.test(key)) {
          scrubbed += 1;
          out[key] = "[redacted]";
        } else {
          out[key] = walk(child, depth + 1);
        }
      }
      return out;
    }
    return value;
  };
  return { value: walk(input, 0) as T, scrubbed };
}

export function parseAlexusReport(raw: unknown): IngestParse {
  if (!isPlainObject(raw)) return { ok: false, reason: "report_must_be_object" };

  const seq = raw.seq;
  if (typeof seq !== "number" || !Number.isInteger(seq) || seq < 1 || seq > 1_000_000_000) {
    return { ok: false, reason: "invalid_seq" };
  }

  const at = raw.at;
  if (typeof at !== "string" || at.length > 40 || !Number.isFinite(Date.parse(at))) {
    return { ok: false, reason: "invalid_at" };
  }
  const reportAtMs = Date.parse(at);
  if (reportAtMs > Date.now() + 10 * 60_000) return { ok: false, reason: "report_from_the_future" };

  const bot = raw.bot;
  if (typeof bot !== "string" || bot.trim().length === 0 || bot.length > 120) {
    return { ok: false, reason: "invalid_bot" };
  }

  if (!isPlainObject(raw.snapshot)) return { ok: false, reason: "invalid_snapshot" };

  const eventsIn = raw.events;
  if (!isPlainObject(eventsIn)) return { ok: false, reason: "invalid_events" };
  const events: Record<string, unknown[]> = {};
  let rows = 0;
  for (const [name, list] of Object.entries(eventsIn)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name)) return { ok: false, reason: "invalid_event_stream_name" };
    if (!Array.isArray(list)) return { ok: false, reason: "invalid_event_stream" };
    rows += list.length;
    if (rows > HERA_INGEST_MAX_EVENT_ROWS) return { ok: false, reason: "too_many_events" };
    events[name] = list;
  }

  const note = typeof raw.note === "string" ? raw.note.slice(0, 500) : "";

  const scrubbedSnapshot = scrubSecrets(raw.snapshot);
  const scrubbedEvents = scrubSecrets(events);
  return {
    ok: true,
    report: {
      bot: bot.trim(),
      seq,
      reportAt: new Date(reportAtMs).toISOString(),
      snapshot: scrubbedSnapshot.value,
      events: scrubbedEvents.value,
      note,
    },
    scrubbed: scrubbedSnapshot.scrubbed + scrubbedEvents.scrubbed,
  };
}
