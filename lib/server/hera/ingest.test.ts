import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleHeraIngest, type HeraIngestDeps, type StoreResult } from "../../../api/_routes/hera/ingest.js";
import { authorizeHeraIngestBearer, verifyHeraIngestSignature } from "./ingestAuth.js";
import { parseAlexusReport, scrubSecrets } from "./ingestPayload.js";
import { HERA_INGEST_OK_LIMIT, resetHeraIngestRateLimits } from "./ingestRateLimit.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TOKEN = "ingest-token-for-tests-0123456789abcdef";
const ENV = { HERA_INGEST_TOKEN: TOKEN };

function sign(body: string, token = TOKEN): string {
  return `sha256=${crypto.createHmac("sha256", token).update(body).digest("hex")}`;
}

function sampleReport(overrides: Record<string, unknown> = {}) {
  return {
    seq: 7,
    at: new Date().toISOString(),
    bot: "Alexus (Synexus Titan AI)",
    snapshot: { heartbeat: { ok: true }, controlSwitchesPresent: ["pause.switch"] },
    events: { outcomes: [{ id: "a", simulatedNetPct: -3.2 }] },
    note: "1 new learning event(s).",
    ...overrides,
  };
}

beforeEach(() => resetHeraIngestRateLimits());

describe("ingest auth", () => {
  test("fails closed when the token is missing or short", () => {
    assert.deepEqual(authorizeHeraIngestBearer(`Bearer ${TOKEN}`, {}), { ok: false, status: 503, error: "ingest_auth_unconfigured" });
    assert.equal(authorizeHeraIngestBearer("Bearer short", { HERA_INGEST_TOKEN: "short" }).ok, false);
  });

  test("does not accept the intel key as an ingest token", () => {
    const result = authorizeHeraIngestBearer(`Bearer ${TOKEN}`, { SYNEXUS_TITAN_API_KEY: TOKEN });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 503);
  });

  test("rejects missing and wrong bearer, accepts the right one", () => {
    assert.equal(authorizeHeraIngestBearer(undefined, ENV).ok, false);
    assert.equal(authorizeHeraIngestBearer("Bearer wrong-wrong-wrong-wrong-wrong-wrong-xx", ENV).ok, false);
    assert.equal(authorizeHeraIngestBearer(`Basic ${TOKEN}`, ENV).ok, false);
    assert.equal(authorizeHeraIngestBearer(`Bearer ${TOKEN}`, ENV).ok, true);
  });

  test("verifies the HMAC signature over the exact body", () => {
    const body = JSON.stringify(sampleReport());
    assert.equal(verifyHeraIngestSignature(sign(body), body, ENV), true);
    assert.equal(verifyHeraIngestSignature(sign(body), `${body} `, ENV), false);
    assert.equal(verifyHeraIngestSignature(sign(body, "another-token-another-token-another-token"), body, ENV), false);
    assert.equal(verifyHeraIngestSignature(undefined, body, ENV), false);
    assert.equal(verifyHeraIngestSignature("sha256=zz", body, ENV), false);
    assert.equal(verifyHeraIngestSignature(sign(body), body, {}), false);
  });
});

describe("report validation", () => {
  test("accepts the report shape Alexus sends", () => {
    const parsed = parseAlexusReport(sampleReport());
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.report.seq, 7);
      assert.equal(parsed.report.events.outcomes?.length, 1);
    }
  });

  test("rejects malformed reports", () => {
    for (const [overrides, reason] of [
      [{ seq: 0 }, "invalid_seq"],
      [{ seq: 1.5 }, "invalid_seq"],
      [{ seq: "7" }, "invalid_seq"],
      [{ at: "yesterday-ish" }, "invalid_at"],
      [{ at: new Date(Date.now() + 3_600_000).toISOString() }, "report_from_the_future"],
      [{ bot: "" }, "invalid_bot"],
      [{ bot: { name: "x" } }, "invalid_bot"],
      [{ snapshot: [] }, "invalid_snapshot"],
      [{ events: [] }, "invalid_events"],
      [{ events: { "bad name!": [] } }, "invalid_event_stream_name"],
      [{ events: { outcomes: "nope" } }, "invalid_event_stream"],
    ] as const) {
      const parsed = parseAlexusReport(sampleReport(overrides));
      assert.equal(parsed.ok, false, JSON.stringify(overrides));
      if (!parsed.ok) assert.equal(parsed.reason, reason);
    }
    assert.equal(parseAlexusReport(null).ok, false);
    assert.equal(parseAlexusReport([]).ok, false);
  });

  test("rejects an absurd number of event rows", () => {
    const parsed = parseAlexusReport(sampleReport({ events: { outcomes: new Array(2001).fill({}) } }));
    assert.equal(parsed.ok, false);
  });

  test("scrubs secret-looking keys but keeps token addresses", () => {
    const { value, scrubbed } = scrubSecrets({
      tokenAddress: "So11111111111111111111111111111111111111112",
      nested: { apiKey: "abc", privateKey: "def", list: [{ Authorization: "Bearer x", ok: 1 }] },
      walletSecretSeed: "ghi",
    });
    assert.equal(scrubbed, 4);
    assert.equal(value.tokenAddress, "So11111111111111111111111111111111111111112");
    assert.equal(value.nested.apiKey, "[redacted]");
    assert.equal(value.nested.list[0]?.ok, 1);
    assert.equal(value.walletSecretSeed, "[redacted]");
  });
});

type Stored = { seq: number; bot: string; scrubbed: number };

async function withServer(
  store: HeraIngestDeps["store"],
  run: (url: string) => Promise<void>,
  env: Record<string, string | undefined> = ENV,
): Promise<void> {
  const server = createServer((req, res) => {
    void handleHeraIngest(req, res, env, { store });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  try {
    await run(`http://127.0.0.1:${address.port}/api/hera/ingest`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function post(url: string, body: string, headers: Record<string, string> = {}) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body });
}

describe("http handler", () => {
  test("stores a correctly signed report and replies without any instruction", async () => {
    const stored: Stored[] = [];
    await withServer(
      async (report, meta) => {
        stored.push({ seq: report.seq, bot: report.bot, scrubbed: meta.scrubbed });
        return { ok: true };
      },
      async (url) => {
        const body = JSON.stringify(sampleReport({ snapshot: { apiKey: "leak", heartbeat: {} } }));
        const res = await post(url, body, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(body) });
        const text = await res.text();
        assert.equal(res.status, 200);
        const json = JSON.parse(text) as Record<string, unknown>;
        assert.deepEqual(Object.keys(json).sort(), ["executesTrades", "ok", "received", "scrubbedValues", "seq", "walletSigning"]);
        assert.equal(json.executesTrades, false);
        assert.equal(json.walletSigning, false);
        assert.equal(json.scrubbedValues, 1);
        assert.equal(text.includes(TOKEN), false);
      },
    );
    assert.deepEqual(stored, [{ seq: 7, bot: "Alexus (Synexus Titan AI)", scrubbed: 1 }]);
  });

  test("rejects missing or wrong bearer with 401 before reading or storing anything", async () => {
    let calls = 0;
    await withServer(
      async () => {
        calls += 1;
        return { ok: true };
      },
      async (url) => {
        const body = JSON.stringify(sampleReport());
        const none = await post(url, body);
        assert.equal(none.status, 401);
        const wrong = await post(url, body, { authorization: "Bearer wrong-wrong-wrong-wrong-wrong-wrong-xx", "x-alexus-signature": sign(body) });
        assert.equal(wrong.status, 401);
        assert.equal(((await wrong.json()) as { error: string }).error, "unauthorized");
      },
    );
    assert.equal(calls, 0);
  });

  test("rejects a good bearer with a bad or missing signature", async () => {
    let calls = 0;
    await withServer(
      async () => {
        calls += 1;
        return { ok: true };
      },
      async (url) => {
        const body = JSON.stringify(sampleReport());
        const tampered = await post(url, body, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(`${body}x`) });
        assert.equal(tampered.status, 401);
        assert.equal(((await tampered.json()) as { error: string }).error, "bad_signature");
        const missing = await post(url, body, { authorization: `Bearer ${TOKEN}` });
        assert.equal(missing.status, 401);
      },
    );
    assert.equal(calls, 0);
  });

  test("returns 503 when the token is not configured", async () => {
    await withServer(
      async () => ({ ok: true }),
      async (url) => {
        const res = await post(url, "{}", { authorization: `Bearer ${TOKEN}` });
        assert.equal(res.status, 503);
        assert.equal(((await res.json()) as { error: string }).error, "ingest_auth_unconfigured");
      },
      {},
    );
  });

  test("rejects oversized and invalid bodies", async () => {
    await withServer(
      async () => ({ ok: true }),
      async (url) => {
        const big = JSON.stringify(sampleReport({ note: "x".repeat(10), snapshot: { blob: "y".repeat(3_100_000) } }));
        const tooBig = await post(url, big, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(big) });
        assert.equal(tooBig.status, 413);

        const notJson = "not json";
        const bad = await post(url, notJson, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(notJson) });
        assert.equal(bad.status, 400);
        assert.equal(((await bad.json()) as { error: string }).error, "invalid_json");

        const invalid = JSON.stringify(sampleReport({ seq: -1 }));
        const rejected = await post(url, invalid, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(invalid) });
        assert.equal(rejected.status, 400);
        assert.equal(((await rejected.json()) as { error: string }).error, "invalid_report");
      },
    );
  });

  test("answers 503 so Alexus keeps the report queued when storage is not ready", async () => {
    for (const reason of ["storage_unconfigured", "storage_not_ready", "storage_unavailable"] as const) {
      await withServer(
        async (): Promise<StoreResult> => ({ ok: false, reason }),
        async (url) => {
          const body = JSON.stringify(sampleReport());
          const res = await post(url, body, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(body) });
          assert.equal(res.status, 503);
          assert.equal(((await res.json()) as { error: string }).error, reason);
        },
      );
    }
    await withServer(
      async () => {
        throw new Error("db exploded with secret detail");
      },
      async (url) => {
        const body = JSON.stringify(sampleReport());
        const res = await post(url, body, { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(body) });
        const text = await res.text();
        assert.equal(res.status, 503);
        assert.equal(text.includes("secret detail"), false);
      },
    );
  });

  test("only POST is allowed", async () => {
    await withServer(
      async () => ({ ok: true }),
      async (url) => {
        const res = await fetch(url, { method: "GET" });
        assert.equal(res.status, 405);
        assert.equal(res.headers.get("allow"), "POST");
      },
    );
  });

  test("rate limits accepted reports per token", async () => {
    await withServer(
      async () => ({ ok: true }),
      async (url) => {
        const body = JSON.stringify(sampleReport());
        const headers = { authorization: `Bearer ${TOKEN}`, "x-alexus-signature": sign(body) };
        const statuses: number[] = [];
        for (let i = 0; i <= HERA_INGEST_OK_LIMIT; i += 1) statuses.push((await post(url, body, headers)).status);
        assert.equal(statuses[HERA_INGEST_OK_LIMIT - 1], 200);
        assert.equal(statuses[HERA_INGEST_OK_LIMIT], 429);
      },
    );
  });
});

describe("wiring", () => {
  test("registers the route and keeps the ingest token out of frontend code", () => {
    const gateway = readFileSync(path.join(ROOT, "api/gateway.ts"), "utf8");
    const vite = readFileSync(path.join(ROOT, "vite.config.ts"), "utf8");
    assert.match(gateway, /\/api\/hera\/ingest/);
    assert.match(vite, /configureHeraIngestApi/);
    assert.equal(vite.includes("HERA_INGEST_TOKEN"), false);

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const text = readFileSync(full, "utf8");
          if (text.includes("HERA_INGEST_TOKEN") || text.includes("VITE_HERA_INGEST")) offenders.push(full);
        }
      }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(offenders, []);
  });

  test("the migration is row-level-secured with no client policies", () => {
    const sql = readFileSync(path.join(ROOT, "supabase/alexus_reports.sql"), "utf8");
    assert.match(sql, /enable row level security/i);
    assert.equal(/create policy/i.test(sql), false);
  });
});
