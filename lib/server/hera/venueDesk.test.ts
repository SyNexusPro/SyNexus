import assert from "node:assert/strict";
import test from "node:test";
import { formatAlexusLearning } from "./alexusLearning.js";
import {
  changeFromOpen,
  formatVenueDesk,
  needsVenueDesk,
  quoteFromBybit,
  quoteFromCoinbase,
  quotesFromBinance,
  quotesFromKraken,
} from "./venueDesk.js";
import { buildTitanSystemPrompt, type TitanPromptInput } from "../titan/prompt.js";

test("coinbase change is computed from open and last, and a missing last stays null", () => {
  const quote = quoteFromCoinbase("BTC-USD", { open: "100", last: "110", volume: "1" });
  assert.equal(quote.priceUsd, 110);
  assert.equal(quote.change24hPct, 10);
  const blank = quoteFromCoinbase("ETH-USD", {});
  assert.equal(blank.priceUsd, null);
  assert.equal(blank.change24hPct, null);
  assert.equal(changeFromOpen(50, 0), null);
});

test("binance, kraken, and bybit map only the numbers they actually send", () => {
  const binance = quotesFromBinance([{ symbol: "BTCUSDT", lastPrice: "200", priceChangePercent: "-1.5" }]);
  assert.equal(binance[0]?.priceUsd, 200);
  assert.equal(binance[0]?.change24hPct, -1.5);
  const kraken = quotesFromKraken({ result: { XXBTZUSD: { c: ["300"], o: "250" } } });
  assert.equal(kraken[0]?.pair, "BTC-USD");
  assert.equal(kraken[0]?.change24hPct, 20);
  const bybit = quoteFromBybit("BTCUSDT", { result: { list: [{ lastPrice: "10", price24hPcnt: "0.01" }] } });
  assert.equal(bybit.change24hPct, 1);
});

test("a failed venue is labelled unavailable and its price is not invented", () => {
  const brief = formatVenueDesk("2026-10-31T00:00:00.000Z", [
    { venue: "Coinbase", pair: "BTC-USD", priceUsd: 100, change24hPct: 1 },
    { venue: "Binance", pair: "BTCUSDT", priceUsd: null, change24hPct: null, note: "451" },
  ]);
  assert.match(brief, /Coinbase BTC-USD: \$100/);
  assert.match(brief, /Binance BTCUSDT: unavailable \(451\)/);
  assert.doesNotMatch(brief, /Binance BTCUSDT: \$/);
  assert.match(brief, /not a buy signal/);
});

test("venue desk is pulled for a bitcoin price question and not for an unrelated coding question", () => {
  assert.equal(needsVenueDesk("what's bitcoin on coinbase right now"), true);
  assert.equal(needsVenueDesk("what has Alexus learned"), true);
  assert.equal(needsVenueDesk("write a python function that sorts a list"), false);
});

test("alexus brief keeps measured lines and refuses to invent a result when none was stored", () => {
  const brief = formatAlexusLearning({
    alexusLessons: { lines: ["Paper results n=40 mean -2.0%. Not a live fill."] },
    worldLearn: { items: [{ source: "Coinbase", title: "BTC-USD 100", extra: "24h +1%" }] },
  }, "2026-10-31T00:00:00.000Z");
  assert.match(brief, /n=40/);
  assert.match(brief, /Coinbase: BTC-USD 100/);
  assert.match(brief, /cannot trade/);
  const empty = formatAlexusLearning({});
  assert.match(empty, /Do not invent/);
});

test("the system prompt carries the desk and the lesson without turning them into an order", () => {
  const input = {
    operatorName: "there",
    titanBotName: "Hera",
    plan: "FREE",
    alertCount: 0,
    watchlistCount: 0,
    feedSource: "live",
    marketBrief: "none",
    venueDesk: "VENUE DESK as of now\n- Coinbase BTC-USD: $1",
    alexusLearning: "ALEXUS LEARNING\n- Paper results n=4. Too few to learn a rule.",
  } satisfies TitanPromptInput;
  const prompt = buildTitanSystemPrompt(input);
  assert.match(prompt, /VENUE DESK/);
  assert.match(prompt, /ALEXUS LEARNING/);
  assert.match(prompt, /cannot trade/);
});
