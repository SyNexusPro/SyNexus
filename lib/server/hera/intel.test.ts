import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { handleHeraIntel, parseIntelRequest } from "../../../api/_routes/hera/intel.js";
import { buildHeraIntelReport } from "./intelReport.js";
import { HERA_INTEL_FAIL_LIMIT, HERA_INTEL_OK_LIMIT, resetHeraIntelRateLimits } from "./intelRateLimit.js";
import {
  blankMarket,
  blankSecurity,
  interpretMintAccount,
  loadMarketReading,
  loadSecurityReading,
  marketFromDexPayload,
  marketFromGeckoPayload,
  type MarketReading,
  type SecurityReading,
} from "./intelSources.js";
import { authorizeHeraIntel, bearerMatchesKey } from "./partnerAuth.js";
import { parseSolanaMint } from "./solanaMint.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WSOL = "So11111111111111111111111111111111111111112";
const KEY = "hera-intel-test-key-0123456789";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function market(partial: Partial<MarketReading> = {}): MarketReading {
  return {
    status: "available",
    source: "DexScreener",
    sources: [{ name: "DexScreener", status: "match" }],
    symbol: "BONK",
    name: "Bonk",
    priceUsd: 0.00002,
    liquidityUsd: 250_000,
    volume24hUsd: 80_000,
    marketCapUsd: 1_000_000,
    fdvUsd: 1_200_000,
    priceChange5mPct: 0.2,
    priceChange1hPct: 1,
    priceChange24hPct: 4,
    buys24h: 20,
    sells24h: 18,
    pairUrl: "https://dexscreener.com/solana/pair",
    dexId: "raydium",
    pairCreatedAtMs: Date.UTC(2024, 0, 1),
    boostActive: 0,
    socialLinkCount: 1,
    ...partial,
  };
}

function security(partial: Partial<SecurityReading> = {}): SecurityReading {
  return {
    status: "measured",
    program: "spl-token",
    decimals: 5,
    supply: "1000",
    mintAuthorityActive: false,
    freezeAuthorityActive: false,
    ...partial,
  };
}

function mockReq(method: string, headers: Record<string, string | string[]>, body = "", ip = "203.0.113.10"): IncomingMessage {
  const stream = Readable.from(body ? [Buffer.from(body)] : []);
  const req = stream as IncomingMessage;
  req.method = method;
  req.headers = headers;
  req.socket = { remoteAddress: ip } as IncomingMessage["socket"];
  req.url = "/api/hera/intel";
  return req;
}

function mockRes() {
  let resolveDone: (value: string) => void = () => {};
  const finished = new Promise<string>((resolve) => {
    resolveDone = resolve;
  });
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string | number) {
      this.headers[name.toLowerCase()] = String(value);
    },
    end(payload?: string) {
      resolveDone(payload ?? "");
    },
    finished,
  };
}

const quietDeps = {
  async loadMarket(): Promise<MarketReading> {
    return market();
  },
  async loadSecurity(): Promise<SecurityReading> {
    return security();
  },
};

beforeEach(() => {
  resetHeraIntelRateLimits();
});

describe("partner auth", () => {
  test("fails closed when the partner key is missing or short", () => {
    assert.equal(authorizeHeraIntel(`Bearer ${KEY}`, {}).status, 503);
    assert.equal(authorizeHeraIntel(`Bearer ${KEY}`, { SYNEXUS_TITAN_API_KEY: "short-key" }).status, 503);
    assert.equal(authorizeHeraIntel(`Bearer ${KEY}`, { SYNEXUS_TITAN_API_KEY: "   " }).status, 503);
  });

  test("does not accept unrelated secrets", () => {
    const env = {
      TITAN_API_KEY: KEY,
      TITAN_EVENT_SECRET: KEY,
      CRON_SECRET: KEY,
      HELIUS_WEBHOOK_SECRET: KEY,
      SYNEXUS_OWNER_PASSWORD: KEY,
    };
    assert.equal(authorizeHeraIntel(`Bearer ${KEY}`, env).status, 503);
  });

  test("rejects missing, malformed, prefix, and wrong bearers", () => {
    const env = { SYNEXUS_TITAN_API_KEY: KEY };
    assert.deepEqual(authorizeHeraIntel(undefined, env), { ok: false, status: 401, error: "unauthorized" });
    assert.equal(authorizeHeraIntel("Basic abc", env).status, 401);
    assert.equal(authorizeHeraIntel(`Bearer ${KEY} extra`, env).status, 401);
    assert.equal(authorizeHeraIntel(`Bearer ${KEY.slice(0, -1)}`, env).status, 401);
    assert.equal(authorizeHeraIntel(`Bearer ${KEY}x`, env).status, 401);
    assert.equal(authorizeHeraIntel([`Bearer ${KEY}`], env).status, 401);
    assert.equal(authorizeHeraIntel(`Bearer ${"A".repeat(257)}`, env).status, 401);
  });

  test("accepts the exact bearer and a case-insensitive scheme", () => {
    const auth = authorizeHeraIntel(`bearer ${KEY}`, { SYNEXUS_TITAN_API_KEY: `  ${KEY}  ` });
    assert.equal(auth.ok, true);
    if (auth.ok) assert.equal(auth.keyId.length, 16);
  });

  test("compares unequal lengths without throwing", () => {
    assert.equal(bearerMatchesKey("short", KEY), false);
    assert.equal(bearerMatchesKey(KEY, KEY), true);
  });
});

describe("request validation", () => {
  test("requires a 32-byte solana mint and ignores trade fields", () => {
    assert.equal(parseSolanaMint(WSOL), WSOL);
    assert.equal(parseSolanaMint("not-a-mint"), null);
    assert.equal(parseSolanaMint("0x0000000000000000000000000000000000000000"), null);
    assert.equal(parseIntelRequest({ mint: WSOL, symbol: "sol", chain: "Solana" }).ok, true);
    assert.equal(parseIntelRequest({ mint: WSOL, trade: true }).reason, "unexpected_field");
    assert.equal(parseIntelRequest({ mint: "" }).reason, "mint_required");
    assert.equal(parseIntelRequest({ mint: "nope" }).reason, "invalid_mint");
    assert.equal(parseIntelRequest({ mint: WSOL, chain: "ethereum" }).reason, "unsupported_chain");
    assert.equal(parseIntelRequest({ mint: WSOL, symbol: "has space" }).reason, "invalid_symbol");
  });
});

describe("market readings", () => {
  test("keeps omitted dex fields null and ignores a different mint", () => {
    const reading = marketFromDexPayload(WSOL, [
      {
        chainId: "solana",
        dexId: "raydium",
        url: "javascript:alert(1)",
        baseToken: { address: WSOL, symbol: "SOL", name: "Wrapped SOL" },
        priceUsd: "nope",
        liquidity: {},
      },
      {
        chainId: "solana",
        baseToken: { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" },
        liquidity: { usd: 9_000_000 },
      },
    ]);
    assert.equal(reading?.priceUsd, null);
    assert.equal(reading?.liquidityUsd, null);
    assert.equal(reading?.symbol, "SOL");
    assert.equal(reading?.pairUrl, null);
    assert.equal(JSON.stringify(reading).includes("9000000"), false);
  });

  test("does not call gecko after a dex match, and does not invent liquidity", async () => {
    let calls = 0;
    const reading = await loadMarketReading(WSOL, async (url) => {
      calls += 1;
      assert.match(String(url), /dexscreener\.com/);
      return new Response(JSON.stringify([
        { chainId: "solana", baseToken: { address: WSOL, symbol: "SOL", name: "Wrapped SOL" }, priceUsd: "140" },
      ]), { status: 200, headers: { "content-type": "application/json" } });
    });
    assert.equal(calls, 1);
    assert.equal(reading.status, "available");
    assert.equal(reading.priceUsd, 140);
    assert.equal(reading.liquidityUsd, null);
    assert.equal(reading.volume24hUsd, null);
  });

  test("reports source failure instead of an empty book", async () => {
    const reading = await loadMarketReading(WSOL, async () => new Response("no", { status: 503 }));
    assert.equal(reading.status, "unavailable");
    assert.deepEqual(reading.sources.map((source) => source.status), ["failed", "failed"]);
    assert.equal(reading.liquidityUsd, null);
  });

  test("uses gecko only when its base token matches and leaves boosts unchecked", () => {
    const reading = marketFromGeckoPayload(WSOL, {
      data: [
        {
          attributes: { address: "pool1", name: "OTHER / SOL", reserve_in_usd: "10", token_price_usd: "1" },
          relationships: { base_token: { data: { id: "solana_otherMint" } } },
        },
        {
          attributes: { address: "pool2", name: "SOL / USDC", reserve_in_usd: "50", token_price_usd: "140" },
          relationships: { base_token: { data: { id: `solana_${WSOL}` } }, dex: { data: { id: "orca" } } },
        },
      ],
    });
    assert.equal(reading?.source, "GeckoTerminal");
    assert.equal(reading?.priceUsd, 140);
    assert.equal(reading?.liquidityUsd, 50);
    assert.equal(reading?.marketCapUsd, null);
    assert.equal(reading?.boostActive, null);
    assert.equal(reading?.socialLinkCount, null);
    assert.equal(reading?.symbol, "SOL");
  });
});

describe("mint account readings", () => {
  test("reads jsonParsed authority flags without treating missing keys as revoked", () => {
    const measured = interpretMintAccount({
      owner: TOKEN_PROGRAM,
      data: {
        parsed: {
          type: "mint",
          info: { decimals: 9, supply: "1", isInitialized: true, mintAuthority: null, freezeAuthority: "FreezeAuthority111111111111111111111111111" },
        },
      },
    });
    assert.equal(measured.status, "measured");
    assert.equal(measured.mintAuthorityActive, false);
    assert.equal(measured.freezeAuthorityActive, true);

    const partial = interpretMintAccount({
      owner: TOKEN_PROGRAM,
      data: { parsed: { type: "mint", info: { decimals: 6, isInitialized: true } } },
    });
    assert.equal(partial.mintAuthorityActive, null);
    assert.equal(partial.freezeAuthorityActive, null);
    assert.equal(interpretMintAccount(null).status, "not_found");
  });

  test("decodes a raw spl mint and does not leak the rpc url", async () => {
    const raw = Buffer.alloc(82);
    raw.writeUInt32LE(1, 0);
    raw.writeBigUInt64LE(42n, 36);
    raw.writeUInt8(6, 44);
    raw.writeUInt8(1, 45);
    raw.writeUInt32LE(0, 46);
    const decoded = interpretMintAccount({
      owner: TOKEN_PROGRAM,
      data: [raw.toString("base64"), "base64"],
    });
    assert.equal(decoded.mintAuthorityActive, true);
    assert.equal(decoded.freezeAuthorityActive, false);
    assert.equal(decoded.supply, "42");

    const secretUrl = "https://rpc.example/rpc?api-key=supersecretvalue";
    const reading = await loadSecurityReading(WSOL, { SOLANA_RPC_URL: secretUrl }, async () => {
      return new Response(JSON.stringify({ result: { value: null } }), { status: 200 });
    });
    assert.equal(reading.status, "not_found");
    assert.equal(JSON.stringify(reading).includes("supersecretvalue"), false);
    assert.equal(JSON.stringify(await loadSecurityReading(WSOL, {})).includes("not_configured"), true);
  });
});

describe("intel report", () => {
  const now = Date.UTC(2026, 0, 2);

  test("does not invent a score or a scam verdict when sources have no measurements", () => {
    const report = buildHeraIntelReport({
      mint: WSOL,
      requestedSymbol: null,
      capturedAtMs: now,
      market: blankMarket("unavailable", [
        { name: "DexScreener", status: "failed" },
        { name: "GeckoTerminal", status: "failed" },
      ]),
      security: blankSecurity("not_configured"),
    });
    assert.equal(report.scamVerdict, null);
    assert.equal(report.safetyClearance, false);
    assert.equal(report.executesTrades, false);
    assert.equal(report.walletSigning, false);
    assert.equal(report.risk.score, null);
    assert.equal(report.risk.band, "INSUFFICIENT_DATA");
    assert.equal(report.warnings.length, 0);
    assert.equal(report.market.liquidityUsd, null);
    assert.ok(report.checksNotPerformed.includes("holder concentration"));
    assert.ok(report.checksNotPerformed.includes("honeypot or sell simulation"));
    assert.ok(report.checksNotPerformed.includes("mint authority"));
    assert.equal(JSON.stringify(report).includes("honeypotPassed"), false);
    assert.equal(JSON.stringify(report).includes(KEY), false);
  });

  test("warns from measured liquidity and mint authority without clearing the token", () => {
    const thin = buildHeraIntelReport({
      mint: WSOL,
      requestedSymbol: "SOL",
      capturedAtMs: now,
      market: market({ liquidityUsd: 1_000, volume24hUsd: 1_000, symbol: "SOL" }),
      security: security(),
    });
    assert.equal(thin.warnings.some((warning) => warning.code === "thin_liquidity"), true);
    assert.equal(thin.risk.band, "HIGH");
    assert.equal(thin.safetyClearance, false);

    const authority = buildHeraIntelReport({
      mint: WSOL,
      requestedSymbol: null,
      capturedAtMs: now,
      market: market(),
      security: security({ mintAuthorityActive: true }),
    });
    assert.equal(authority.warnings.some((warning) => warning.code === "mint_authority_active"), true);
    assert.equal(authority.risk.band, "HIGH");
    assert.equal(authority.scamVerdict, null);
    assert.match(authority.note, /not a trade instruction/i);
  });

  test("uses a fast-move warning only when age and 24h change were both measured", () => {
    const created = now - 2 * 60 * 60 * 1000;
    const warned = buildHeraIntelReport({
      mint: WSOL,
      requestedSymbol: null,
      capturedAtMs: now,
      market: market({ pairCreatedAtMs: created, priceChange24hPct: 55, liquidityUsd: 250_000 }),
      security: security(),
    });
    assert.equal(warned.warnings.some((warning) => warning.code === "new_pair_fast_move"), true);

    const missingChange = buildHeraIntelReport({
      mint: WSOL,
      requestedSymbol: null,
      capturedAtMs: now,
      market: market({ pairCreatedAtMs: created, priceChange24hPct: null }),
      security: security(),
    });
    assert.equal(missingChange.warnings.some((warning) => warning.code === "new_pair_fast_move"), false);
    assert.equal(missingChange.market.tokenAgeHours, 2);
    assert.ok(missingChange.checksNotPerformed.includes("24h price change"));
  });
});

describe("http handler", () => {
  test("returns advisory json for a valid mint and hides the key", async () => {
    const server = createServer((req, res) => {
      void handleHeraIntel(req, res, { SYNEXUS_TITAN_API_KEY: KEY }, quietDeps);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    try {
      const ok = await fetch(`http://127.0.0.1:${address.port}/api/hera/intel`, {
        method: "POST",
        headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ mint: WSOL, symbol: "BONK" }),
      });
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get("cache-control") ?? "", /no-store/);
      const body = await ok.json() as { executesTrades: boolean; walletSigning: boolean; scamVerdict: null; mint: string };
      assert.equal(body.executesTrades, false);
      assert.equal(body.walletSigning, false);
      assert.equal(body.scamVerdict, null);
      assert.equal(body.mint, WSOL);
      assert.equal(JSON.stringify(body).includes(KEY), false);

      const denied = await fetch(`http://127.0.0.1:${address.port}/api/hera/intel`, {
        method: "POST",
        headers: { authorization: "Bearer wrong-partner-key-value", "content-type": "application/json" },
        body: JSON.stringify({ mint: WSOL }),
      });
      assert.equal(denied.status, 401);
      const deniedBody = await denied.text();
      assert.equal(deniedBody.includes(KEY), false);
      assert.equal(deniedBody.includes("wrong-partner-key-value"), false);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });

  test("rejects bad input, skips upstream work when unauthorized, and rate limits", async () => {
    let upstream = 0;
    const deps = {
      async loadMarket(): Promise<MarketReading> {
        upstream += 1;
        return market();
      },
      async loadSecurity(): Promise<SecurityReading> {
        upstream += 1;
        return security();
      },
    };
    const env = { SYNEXUS_TITAN_API_KEY: KEY };

    const deniedRes = mockRes();
    await handleHeraIntel(mockReq("POST", { authorization: "Bearer nope-nope-nope-nope" }, "", "198.51.100.8"), deniedRes as unknown as ServerResponse, env, deps);
    assert.equal(deniedRes.statusCode, 401);
    assert.equal(upstream, 0);

    const invalid = mockRes();
    await handleHeraIntel(
      mockReq("POST", { authorization: `Bearer ${KEY}` }, JSON.stringify({ mint: "bad" }), "198.51.100.9"),
      invalid as unknown as ServerResponse,
      env,
      deps,
    );
    assert.equal(invalid.statusCode, 400);
    assert.equal(upstream, 0);

    const huge = mockRes();
    await handleHeraIntel(
      mockReq("POST", { authorization: `Bearer ${KEY}` }, "x".repeat(5000), "198.51.100.10"),
      huge as unknown as ServerResponse,
      env,
      deps,
    );
    assert.equal(huge.statusCode, 413);

    const get = mockRes();
    await handleHeraIntel(mockReq("GET", { authorization: `Bearer ${KEY}` }, "", "198.51.100.11"), get as unknown as ServerResponse, env, deps);
    assert.equal(get.statusCode, 405);

    const failing = {
      async loadMarket(): Promise<MarketReading> {
        throw new Error("dex down");
      },
      async loadSecurity(): Promise<SecurityReading> {
        return security();
      },
    };
    const failed = mockRes();
    await handleHeraIntel(
      mockReq("POST", { authorization: `Bearer ${KEY}` }, JSON.stringify({ mint: WSOL }), "198.51.100.12"),
      failed as unknown as ServerResponse,
      env,
      failing,
    );
    assert.equal(failed.statusCode, 502);
    assert.equal((await failed.finished).includes("dex down"), false);

    const statuses: number[] = [];
    for (let i = 0; i < HERA_INTEL_FAIL_LIMIT + 1; i += 1) {
      const res = mockRes();
      await handleHeraIntel(
        mockReq("POST", { authorization: "Bearer nope-nope-nope-nope" }, "", "198.51.100.20"),
        res as unknown as ServerResponse,
        env,
        deps,
      );
      statuses.push(res.statusCode);
    }
    assert.equal(statuses[HERA_INTEL_FAIL_LIMIT - 1], 401);
    assert.equal(statuses[HERA_INTEL_FAIL_LIMIT], 429);

    resetHeraIntelRateLimits();
    const okStatuses: number[] = [];
    for (let i = 0; i < HERA_INTEL_OK_LIMIT + 1; i += 1) {
      const res = mockRes();
      await handleHeraIntel(
        mockReq("POST", { authorization: `Bearer ${KEY}` }, JSON.stringify({ mint: WSOL }), `198.51.100.${30 + (i % 20)}`),
        res as unknown as ServerResponse,
        env,
        deps,
      );
      okStatuses.push(res.statusCode);
    }
    assert.equal(okStatuses[HERA_INTEL_OK_LIMIT - 1], 200);
    assert.equal(okStatuses[HERA_INTEL_OK_LIMIT], 429);
  });
});

describe("wiring", () => {
  test("registers the route without putting the partner key in frontend code", () => {
    const gateway = readFileSync(path.join(ROOT, "api/gateway.ts"), "utf8");
    const vite = readFileSync(path.join(ROOT, "vite.config.ts"), "utf8");
    assert.match(gateway, /\/api\/hera\/intel/);
    assert.match(vite, /configureHeraIntelApi/);
    assert.equal(vite.includes("SYNEXUS_TITAN_API_KEY"), false);

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const text = readFileSync(full, "utf8");
          if (text.includes("SYNEXUS_TITAN_API_KEY") || text.includes("VITE_SYNEXUS_TITAN")) offenders.push(full);
        }
      }
    };
    walk(path.join(ROOT, "src"));
    assert.deepEqual(offenders, []);
  });
});
