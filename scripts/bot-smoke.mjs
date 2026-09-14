#!/usr/bin/env node
/**
 * Sentinel + commander smoke: routing, scoring, live production APIs.
 *   npm run bots:check
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = process.env.SYNEXUS_ORIGIN?.trim() || "https://www.synexus.pro";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...readEnvFile(join(root, ".env")), ...process.env };

function isInstantTitanPath(text) {
  const lower = text.toLowerCase().trim();
  if (/^(search|find|scan|look up|lookup)\b/.test(lower)) return true;
  if (
    /sentinel|aegis|pulse|leviathan|cipher|helix/.test(lower) &&
    /status|report|doing|orders?/.test(lower)
  ) {
    return true;
  }
  if (/how many|list.*coin|all coin|every coin|tokens/.test(lower)) return true;
  return false;
}

function classifyEvent(event) {
  if (event.exploitDetected || event.exchangeHack) return "critical";
  if (event.type === "HELIX_PHISH" || event.type === "WALLET_PHISH") return "high";
  const discovery = event.discoveryScore ?? 0;
  const risk = event.riskScore ?? 0;
  const momentum = event.momentumScore ?? 0;
  if (event.type === "LAUNCH_WATCH") return "normal";
  if (risk >= 85 && momentum >= 70) return "critical";
  if (discovery >= 70 || (risk >= 65 && discovery >= 55) || (discovery >= 60 && momentum >= 65)) {
    return "high";
  }
  if (discovery >= 45 || momentum >= 55) return "normal";
  if (event.securityThreat || Math.abs(event.priceChangePercent || 0) >= 15) return "high";
  if ((event.whaleMovementUsd || 0) >= 5_000_000 || (event.transactionValueUsd || 0) >= 5_000_000) {
    return "high";
  }
  if ((event.whaleMovementUsd || 0) >= 50_000 || (event.transactionValueUsd || 0) >= 50_000) {
    return "high";
  }
  if (Math.abs(event.priceChangePercent || 0) >= 5) return "normal";
  return "low";
}

const NAME_TRAP =
  /\b(?:airdrop|drainer|mnemonic|seed\s*phrase|claim\s*now|connect\s*wallet|free\s*nft|wallet\s*verify|validate\s*wallet)\b/i;

function helixHit(symbol, name) {
  return NAME_TRAP.test(`${symbol} ${name}`);
}

let pass = 0;
let fail = 0;

function check(ok, label, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log("─".repeat(title.length));
}

section("Commander routing (instant Titan paths)");
check(isInstantTitanPath("scan BONK"), "scan command");
check(isInstantTitanPath("Helix status"), "Helix status");
check(isInstantTitanPath("Aegis report"), "Aegis report");
check(isInstantTitanPath("Leviathan doing"), "Leviathan doing");
check(!isInstantTitanPath("what is photosynthesis"), "general chat stays LLM");
check(!isInstantTitanPath("hello hera"), "greeting stays LLM");

section("Helix signing-trap names");
check(helixHit("CLAIM", "Airdrop Claim Now"), "airdrop claim name");
check(helixHit("X", "Connect Wallet Token"), "connect-wallet name");
check(!helixHit("BONK", "Bonk"), "BONK is not a Helix trap");

section("Event classifier (Titan / Leviathan / Helix)");
check(classifyEvent({ exploitDetected: true }) === "critical", "exploit → critical");
check(classifyEvent({ type: "HELIX_PHISH" }) === "high", "Helix phish → high");
check(classifyEvent({ type: "LAUNCH_WATCH" }) === "normal", "launch watch → normal");
check(classifyEvent({ whaleMovementUsd: 80_000 }) === "high", "Leviathan whale 80k → high");
check(classifyEvent({ priceChangePercent: 0.4 }) === "low", "tiny move → low");
check(classifyEvent({ riskScore: 90, momentumScore: 80 }) === "critical", "stacked risk → critical");

async function ping(path, init = {}) {
  const url = `${ORIGIN}${path}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

section("Commander LLM (local Groq key)");
try {
  const groqKey = env.TITAN_API_KEY?.trim();
  const groqBase = (env.TITAN_API_BASE?.trim() || "").replace(/\/$/, "");
  if (!groqKey || !/groq\.com/i.test(groqBase)) {
    check(false, "Groq Titan ping", "TITAN_API_KEY / TITAN_API_BASE (groq) missing");
  } else {
    const groqRes = await fetch(`${groqBase}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are Hera. Reply in one short sentence." },
          { role: "user", content: "Helix status." },
        ],
        max_tokens: 80,
        temperature: 0.4,
      }),
    });
    const groqJson = await groqRes.json().catch(() => ({}));
    const reply = groqJson?.choices?.[0]?.message?.content?.trim() || "";
    check(groqRes.ok && reply.length > 0, "Groq openai/gpt-oss-120b", `HTTP ${groqRes.status}`);
    if (reply) console.log(`    ↳ ${reply.slice(0, 120)}`);
  }
} catch (err) {
  check(false, "Groq Titan ping", err instanceof Error ? err.message : String(err));
}

section(`Live production APIs (${ORIGIN})`);

try {
  const warm = await ping("/api/titan/warm");
  check(warm.status === 204, "Titan warm", `HTTP ${warm.status}`);
} catch (err) {
  check(false, "Titan warm", err instanceof Error ? err.message : String(err));
}

try {
  const live = await ping("/api/hera/live-token?symbol=BONK");
  const json = await live.json().catch(() => ({}));
  check(live.ok && json.ok !== false, "Hera live-token BONK", `HTTP ${live.status}`);
} catch (err) {
  check(false, "Hera live-token BONK", err instanceof Error ? err.message : String(err));
}

try {
    const syn = await ping("/api/hera/live-token?symbol=SYN");
    check(syn.status === 200 || syn.status === 502, "Hera live-token SYN", `HTTP ${syn.status}`);
} catch (err) {
  check(false, "Hera live-token SYN", err instanceof Error ? err.message : String(err));
}

try {
  const chat = await ping("/api/titan/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Helix status — one sentence.",
      titanBotName: "Hera",
      operatorName: "bot-smoke",
      marketBrief: "Smoke test — no live book.",
      fastMode: true,
      intentHint: "explain",
    }),
  });
  const ctype = chat.headers.get("content-type") || "";
  const text = await chat.text();
  const staleGroq = /llama-3\.3-70b-versatile|model_not_found/i.test(text);
  const streamed = chat.ok && (ctype.includes("text/event-stream") || text.length > 8);
  const jsonReply = (() => {
    try {
      const j = JSON.parse(text);
      return typeof j.reply === "string" && j.reply.length > 0;
    } catch {
      return false;
    }
  })();
  if (staleGroq && !chat.ok) {
    check(
      false,
      "Hera / Titan chat (production)",
      "Groq Llama 3.3 retired — deploy this branch so Vercel remaps to openai/gpt-oss-120b",
    );
  } else {
    check(streamed || jsonReply, "Hera / Titan chat (production)", `HTTP ${chat.status} ${ctype.slice(0, 40)}`);
    if (streamed || jsonReply) {
      const sample = text.replace(/\s+/g, " ").slice(0, 80);
      if (sample) console.log(`    ↳ ${sample}`);
    }
  }
} catch (err) {
  check(false, "Hera / Titan chat", err instanceof Error ? err.message : String(err));
}

try {
  const launch = await ping("/api/hera/launch-watch");
  check(
    launch.status === 200 || launch.status === 204 || launch.status === 502,
    "Hera launch-watch",
    `HTTP ${launch.status}`,
  );
} catch (err) {
  check(false, "Hera launch-watch", err instanceof Error ? err.message : String(err));
}

console.log("\nSummary");
console.log("───────");
console.log(`  Passed: ${pass}`);
console.log(`  Failed: ${fail}`);

if (fail > 0) process.exit(1);
console.log("\n✓ Bot smoke passed");
