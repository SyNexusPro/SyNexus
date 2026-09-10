import type { TitanChartCandle, TitanChartSignal } from "../components/TitanMarketChart";

/** Sample SOL series for Titan market chart (buy/sell markers). */
export const TITAN_DEMO_CANDLES: TitanChartCandle[] = [
  {
    time: "2026-08-11",
    open: 181.2,
    high: 187.4,
    low: 179.8,
    close: 185.9,
  },
  {
    time: "2026-08-12",
    open: 185.9,
    high: 190.2,
    low: 183.6,
    close: 188.7,
  },
  {
    time: "2026-08-13",
    open: 188.7,
    high: 191.4,
    low: 184.3,
    close: 186.2,
  },
  {
    time: "2026-08-14",
    open: 186.2,
    high: 194.8,
    low: 185.1,
    close: 193.4,
  },
];

export const TITAN_DEMO_BUY_SIGNALS: TitanChartSignal[] = [
  {
    time: "2026-08-12",
    text: "▲ TITAN BUY",
  },
];

export const TITAN_DEMO_SELL_SIGNALS: TitanChartSignal[] = [
  {
    time: "2026-08-13",
    text: "▼ TITAN SELL",
  },
];
